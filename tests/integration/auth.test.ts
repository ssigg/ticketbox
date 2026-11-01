import { describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER, auth, tenantsForUser } from '../../src/lib/server/auth';
import { addMembership, createTenant, createUser, uniqueEmail } from '../helpers/db';
import { extractLink, waitForMail } from '../helpers/inbucket';

// Requests go through auth.handler — the same path the app uses — so rate limiting applies.
// Each test uses its own client IP so their rate-limit buckets don't interfere.
function client(ip = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`) {
	return async function call(path: string, body?: unknown, cookie?: string) {
		const headers = new Headers({ origin: process.env.ORIGIN!, [CLIENT_IP_HEADER]: ip });
		if (body) headers.set('content-type', 'application/json');
		if (cookie) headers.set('cookie', cookie);
		const res = await auth.handler(
			new Request(`${process.env.ORIGIN}/api/auth${path}`, {
				method: body ? 'POST' : 'GET',
				headers,
				body: body ? JSON.stringify(body) : undefined
			})
		);
		const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
		return { status: res.status, cookies, json: await res.json().catch(() => null) };
	};
}

describe('sign in', () => {
	it('accepts the correct password, case-insensitive email', async () => {
		const call = client();
		const user = await createUser();
		const res = await call('/sign-in/email', { email: user.email.toUpperCase(), password: user.password });
		expect(res.status).toBe(200);
		expect(res.json.user.id).toBe(user.id);
		expect(res.cookies).toContain('session_token');
	});

	it('rejects a wrong password and unknown users', async () => {
		const call = client();
		const user = await createUser();
		expect((await call('/sign-in/email', { email: user.email, password: 'wrong-pass' })).status).toBe(401);
		expect((await call('/sign-in/email', { email: 'nobody@example.com', password: 'whatever1' })).status).toBe(401);
	});

	it('rate limits repeated attempts per client IP', async () => {
		const call = client();
		const other = client();
		const user = await createUser();
		const statuses = [];
		for (let i = 0; i < 4; i++) {
			statuses.push((await call('/sign-in/email', { email: user.email, password: 'wrong-pass' })).status);
		}
		expect(statuses).toEqual([401, 401, 401, 429]);
		// A different client is not affected.
		expect((await other('/sign-in/email', { email: user.email, password: user.password })).status).toBe(200);
	});

	it('does not allow self sign-up', async () => {
		const res = await client()('/sign-up/email', { email: uniqueEmail(), password: 'password123', name: 'X' });
		expect(res.status).toBe(400);
	});
});

describe('sessions', () => {
	it('returns the session user including isSuperadmin, and signs out', async () => {
		const call = client();
		const user = await createUser({ isSuperadmin: true });
		const { cookies } = await call('/sign-in/email', { email: user.email, password: user.password });

		const session = await auth.api.getSession({ headers: new Headers({ cookie: cookies }) });
		expect(session?.user).toMatchObject({ id: user.id, isSuperadmin: true });

		expect((await call('/sign-out', {}, cookies)).status).toBe(200);
		expect(await auth.api.getSession({ headers: new Headers({ cookie: cookies }) })).toBeNull();
	});
});

describe('password reset', () => {
	async function requestReset(call: ReturnType<typeof client>, email: string) {
		const res = await call('/request-password-reset', {
			email,
			redirectTo: `${process.env.ORIGIN}/admin/reset-password`
		});
		expect(res.status).toBe(200);
		const link = extractLink((await waitForMail(email)).body.text);
		return new URL(link).pathname.split('/').pop()!;
	}

	it('emails a link, resets the password once and logs out all sessions', async () => {
		const call = client();
		const user = await createUser();
		const { cookies } = await call('/sign-in/email', { email: user.email, password: user.password });
		const token = await requestReset(call, user.email);

		expect((await call('/reset-password', { token, newPassword: 'new-password-1' })).status).toBe(200);
		expect((await call('/sign-in/email', { email: user.email, password: 'new-password-1' })).status).toBe(200);
		expect(await auth.api.getSession({ headers: new Headers({ cookie: cookies }) })).toBeNull();

		// single use
		expect((await call('/reset-password', { token, newPassword: 'another-one' })).status).toBe(400);
	});

	it('the emailed link redirects to the admin reset page with the token', async () => {
		const call = client();
		const user = await createUser();
		const token = await requestReset(call, user.email);
		const res = await auth.handler(
			new Request(`${process.env.ORIGIN}/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(`${process.env.ORIGIN}/admin/reset-password`)}`)
		);
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe(`${process.env.ORIGIN}/admin/reset-password?token=${token}`);
	});

	it('answers the same for unknown emails and sends nothing', async () => {
		const res = await client()('/request-password-reset', {
			email: 'ghost@example.com',
			redirectTo: `${process.env.ORIGIN}/admin/reset-password`
		});
		expect(res.status).toBe(200);
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
