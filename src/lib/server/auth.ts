import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { db } from './db';
import * as schema from './db/schema';
import { env } from './env';
import { sendPasswordResetMail } from './mail';

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
		sendResetPassword: async ({ user, url }) => {
			await sendPasswordResetMail(user.email, url);
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

/** Creates a user with an email/password account. Self sign-up is disabled, so this bypasses the API. */
export async function createUserWithPassword(input: {
	email: string;
	name: string;
	password: string;
	isSuperadmin?: boolean;
}) {
	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.createUser({
		email: input.email.trim().toLowerCase(),
		name: input.name,
		emailVerified: true,
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
