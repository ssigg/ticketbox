import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, authenticate, createSession, sessionCookieOptions } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

function safeRedirect(target: string | null): string {
	return target && target.startsWith('/admin') && !target.startsWith('//') ? target : '/admin';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');

		const user = await authenticate(email, password);
		if (!user) return fail(400, { email, error: 'Invalid email or password.' });

		const { token, expiresAt } = await createSession(user.id);
		cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
		redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	}
};
