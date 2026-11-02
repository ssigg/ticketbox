import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { db } from './db';
import * as schema from './db/schema';
import { env } from './env';
import { sendPasswordResetMail } from './mail';
import { extractLocaleFromRequest } from '../paraglide/runtime.js';

/**
 * Set by hooks.server.ts from SvelteKit's getClientAddress() (which honours adapter-node's
 * ADDRESS_HEADER/XFF_DEPTH), so clients cannot spoof the address used for rate limiting.
 */
export const CLIENT_IP_HEADER = 'x-ticketbox-client-ip';

export const auth = betterAuth({
	baseURL: env.origin,
	secret: env.authSecret,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications,
			rateLimit: schema.rateLimits
		}
	}),
	emailAndPassword: {
		enabled: true,
		// Merchant users are created by admins (and the seed script), never by self sign-up.
		disableSignUp: true,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, url }, request) => {
			// Same negotiation as the UI: language cookie, then Accept-Language.
			const locale = request ? extractLocaleFromRequest(request) : undefined;
			await sendPasswordResetMail(user.email, url, locale);
		},
		// Setting a password via the emailed link proves the address; it also marks invitations as accepted.
		onPasswordReset: async ({ user }) => {
			if (!user.emailVerified) {
				await db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, user.id));
			}
		}
	},
	user: {
		additionalFields: {
			isSuperadmin: { type: 'boolean', defaultValue: false, input: false }
		}
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24
	},
	rateLimit: {
		// Better Auth only enables it in production by default; we want it everywhere,
		// stored in Postgres so it holds across restarts and multiple instances.
		enabled: true,
		storage: 'database'
	},
	advanced: {
		ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] }
	},
	telemetry: { enabled: false }
});

export type SessionUser = typeof auth.$Infer.Session.user;

/**
 * Creates a user with an email/password account. Self sign-up is disabled, so this bypasses the API.
 * Invited users start with `emailVerified: false` and a random password until they set their own.
 */
export async function createUserWithPassword(input: {
	email: string;
	name: string;
	password: string;
	isSuperadmin?: boolean;
	emailVerified?: boolean;
}) {
	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.createUser({
		email: input.email.trim().toLowerCase(),
		name: input.name,
		emailVerified: input.emailVerified ?? true,
		isSuperadmin: input.isSuperadmin ?? false
	}, { method: 'email-password' });
	await ctx.internalAdapter.linkAccount({
		userId: user.id,
		accountId: user.id,
		providerId: 'credential',
		password: await ctx.password.hash(input.password)
	});
	return user;
}

/**
 * A link that lets the user choose a password, using Better Auth's reset-password tokens
 * (same storage and flow as "Forgot password", but with a longer lifetime for invitations).
 */
export async function createPasswordSetupUrl(userId: string, ttlSeconds: number): Promise<string> {
	const ctx = await auth.$context;
	const token = randomBytes(18).toString('base64url');
	await ctx.internalAdapter.createVerificationValue({
		identifier: `reset-password:${token}`,
		value: userId,
		expiresAt: new Date(Date.now() + ttlSeconds * 1000)
	});
	const callbackURL = encodeURIComponent(`${env.origin}/admin/reset-password`);
	return `${ctx.baseURL}/reset-password/${token}?callbackURL=${callbackURL}`;
}

/** Tenants the user may administer; superadmins see all of them. */
export async function tenantsForUser(user: Pick<SessionUser, 'id' | 'isSuperadmin'>) {
	const { memberships, tenants } = schema;
	if (user.isSuperadmin) {
		const all = await db.select().from(tenants).orderBy(tenants.name);
		return all.map((tenant) => ({ ...tenant, role: 'owner' as const }));
	}
	return db
		.select({
			id: tenants.id,
			slug: tenants.slug,
			name: tenants.name,
			defaultLocale: tenants.defaultLocale,
			currency: tenants.currency,
			createdAt: tenants.createdAt,
			role: memberships.role
		})
		.from(memberships)
		.innerJoin(tenants, eq(tenants.id, memberships.tenantId))
		.where(eq(memberships.userId, user.id))
		.orderBy(tenants.name);
}
