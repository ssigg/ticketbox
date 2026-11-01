import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import {
	SESSION_COOKIE,
	invalidateSession,
	sessionCookieOptions,
	validateSession
} from '#lib/server/auth.ts';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = null;

	if (token) {
		const session = await validateSession(token);
		if (session) {
			event.locals.user = session.user;
			event.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(session.expiresAt));
		} else {
			await invalidateSession(token);
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	const path = event.url.pathname;
	const isAdmin = path === '/admin' || path.startsWith('/admin/');
	const isPublic = PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + '/'));
	if (isAdmin && !isPublic && !event.locals.user) {
		redirect(303, `/admin/login?redirectTo=${encodeURIComponent(path + event.url.search)}`);
	}

	return resolve(event);
};
