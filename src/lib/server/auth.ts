import { hash, verify } from '@node-rs/argon2';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';
import { and, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { env } from './env';
import { memberships, passwordResets, sessions, tenants, users, type User } from './db/schema';

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'session';
export const SESSION_TTL = 30 * DAY;
const RESET_TTL = 60 * 60 * 1000;

// Used when the email is unknown so login timing does not reveal which accounts exist.
const DUMMY_HASH = await hash('dummy-password-for-timing');

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'isSuperadmin'>;

export function generateToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(20));
	return encodeBase32LowerCaseNoPadding(bytes);
}

function hashToken(token: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export function hashPassword(password: string): Promise<string> {
	return hash(password);
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
	const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email)));
	const valid = await verify(user?.passwordHash ?? DUMMY_HASH, password);
	if (!user || !valid) return null;
	return { id: user.id, email: user.email, name: user.name, isSuperadmin: user.isSuperadmin };
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
	const token = generateToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL);
	await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
	return { token, expiresAt };
}

/** Returns the session's user, extending the session when it is past half its lifetime. */
export async function validateSession(
	token: string
): Promise<{ user: SessionUser; expiresAt: Date } | null> {
	const id = hashToken(token);
	const [row] = await db
		.select({
			expiresAt: sessions.expiresAt,
			user: { id: users.id, email: users.email, name: users.name, isSuperadmin: users.isSuperadmin }
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id));
	if (!row) return null;

	if (row.expiresAt.getTime() <= Date.now()) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	if (row.expiresAt.getTime() - Date.now() < SESSION_TTL / 2) {
		row.expiresAt = new Date(Date.now() + SESSION_TTL);
		await db.update(sessions).set({ expiresAt: row.expiresAt }).where(eq(sessions.id, id));
	}
	return row;
}

export async function invalidateSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Creates a reset token for the email, or returns null if no such user exists. */
export async function createPasswordReset(
	email: string
): Promise<{ token: string; user: User } | null> {
	const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email)));
	if (!user) return null;
	const token = generateToken();
	await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
	await db
		.insert(passwordResets)
		.values({ id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL) });
	return { token, user };
}

export async function isValidResetToken(token: string): Promise<boolean> {
	const [row] = await db
		.select({ id: passwordResets.id })
		.from(passwordResets)
		.where(and(eq(passwordResets.id, hashToken(token)), gt(passwordResets.expiresAt, new Date())));
	return !!row;
}

/** Sets a new password and logs the user out everywhere. Returns false for an invalid token. */
export async function resetPassword(token: string, password: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [reset] = await tx
			.delete(passwordResets)
			.where(eq(passwordResets.id, hashToken(token)))
			.returning();
		if (!reset || reset.expiresAt.getTime() <= Date.now()) return false;
		await tx
			.update(users)
			.set({ passwordHash: await hashPassword(password) })
			.where(eq(users.id, reset.userId));
		await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
		return true;
	});
}

/** Tenants the user may administer; superadmins see all of them. */
export async function tenantsForUser(user: SessionUser) {
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

export function sessionCookieOptions(expiresAt: Date) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: env.origin.startsWith('https://'),
		expires: expiresAt
	};
}
