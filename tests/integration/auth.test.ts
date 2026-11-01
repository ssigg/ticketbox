import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	authenticate,
	createPasswordReset,
	createSession,
	invalidateSession,
	isValidResetToken,
	resetPassword,
	tenantsForUser,
	validateSession,
	SESSION_TTL
} from '../../src/lib/server/auth';
import { db } from '../../src/lib/server/db';
import { passwordResets, sessions } from '../../src/lib/server/db/schema';
import { addMembership, createTenant, createUser } from '../helpers/db';

describe('authenticate', () => {
	it('accepts the correct password, case-insensitive email', async () => {
		const user = await createUser({ email: 'Anna@example.com'.toLowerCase() });
		const result = await authenticate('  ANNA@example.com ', user.password);
		expect(result?.id).toBe(user.id);
	});

	it('rejects a wrong password and unknown users', async () => {
		const user = await createUser();
		expect(await authenticate(user.email, 'wrong')).toBeNull();
		expect(await authenticate('nobody@example.com', 'whatever')).toBeNull();
	});
});

describe('sessions', () => {
	it('validates and invalidates a session', async () => {
		const user = await createUser();
		const { token } = await createSession(user.id);
		expect((await validateSession(token))?.user.id).toBe(user.id);

		await invalidateSession(token);
		expect(await validateSession(token)).toBeNull();
	});

	it('does not store the raw token', async () => {
		const user = await createUser();
		const { token } = await createSession(user.id);
		const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
		expect(rows.map((r) => r.id)).not.toContain(token);
	});

	it('rejects expired sessions and extends ageing ones', async () => {
		const user = await createUser();
		const expired = await createSession(user.id);
		const ageing = await createSession(user.id);
		const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
		const [e, a] = rows.sort((x, y) => (x.expiresAt < y.expiresAt ? -1 : 1));
		await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, e.id));
		await db.update(sessions).set({ expiresAt: new Date(Date.now() + 1000 * 60) }).where(eq(sessions.id, a.id));

		const results = await Promise.all([validateSession(expired.token), validateSession(ageing.token)]);
		const valid = results.filter(Boolean);
		expect(valid).toHaveLength(1);
		expect(valid[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now() + SESSION_TTL - 60_000);
	});
});

describe('password reset', () => {
	it('resets the password once and logs out all sessions', async () => {
		const user = await createUser();
		const { token: sessionToken } = await createSession(user.id);
		const reset = await createPasswordReset(user.email);
		expect(reset).not.toBeNull();
		expect(await isValidResetToken(reset!.token)).toBe(true);

		expect(await resetPassword(reset!.token, 'new-password-1')).toBe(true);
		expect(await authenticate(user.email, 'new-password-1')).not.toBeNull();
		expect(await authenticate(user.email, user.password)).toBeNull();
		expect(await validateSession(sessionToken)).toBeNull();

		// single use
		expect(await resetPassword(reset!.token, 'another-one')).toBe(false);
	});

	it('rejects expired tokens', async () => {
		const user = await createUser();
		const reset = await createPasswordReset(user.email);
		await db.update(passwordResets).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(passwordResets.userId, user.id));
		expect(await isValidResetToken(reset!.token)).toBe(false);
		expect(await resetPassword(reset!.token, 'new-password-1')).toBe(false);
	});

	it('returns null for unknown emails', async () => {
		expect(await createPasswordReset('ghost@example.com')).toBeNull();
	});
});

describe('tenantsForUser', () => {
	it('returns only tenants the user is a member of', async () => {
		const user = await createUser();
		const mine = await createTenant('Mine');
		await createTenant('Other');
		await addMembership(user.id, mine.id, 'boxoffice');

		const result = await tenantsForUser(user);
		expect(result.map((t) => [t.slug, t.role])).toEqual([[mine.slug, 'boxoffice']]);
	});

	it('returns every tenant for superadmins', async () => {
		const admin = await createUser({ isSuperadmin: true });
		const all = await tenantsForUser(admin);
		expect(all.length).toBeGreaterThanOrEqual(2);
	});
});
