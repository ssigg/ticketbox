import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { isAuthPath } from 'better-auth/svelte-kit';
import { CLIENT_IP_HEADER, auth } from '#lib/server/auth.ts';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];

export const handle: Handle = async ({ event, resolve }) => {
	if (isAuthPath(event.url.toString(), auth.options)) {
		// Replace any client-sent value so the rate limiter keys on the real address.
		const headers = new Headers(event.request.headers);
		headers.set(CLIENT_IP_HEADER, event.getClientAddress());
		return auth.handler(new Request(event.request, { headers, duplex: 'half' } as RequestInit));
	}

	const result = await auth.api.getSession({ headers: event.request.headers, returnHeaders: true });
	event.locals.user = result.response?.user ?? null;
	event.locals.session = result.response?.session ?? null;

	const path = event.url.pathname;
	const isAdmin = path === '/admin' || path.startsWith('/admin/');
	const isPublic = PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + '/'));
	if (isAdmin && !isPublic && !event.locals.user) {
		redirect(303, `/admin/login?redirectTo=${encodeURIComponent(path + event.url.search)}`);
	}

	const response = await resolve(event);
	// getSession refreshes the session cookie once per `updateAge`; pass that on.
	for (const cookie of result.headers?.getSetCookie() ?? []) {
		response.headers.append('set-cookie', cookie);
	}
	return response;
};
