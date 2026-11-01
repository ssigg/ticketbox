import { fail } from '@sveltejs/kit';
import { isValidResetToken, resetPassword } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

const MIN_PASSWORD_LENGTH = 8;

export const load: PageServerLoad = async ({ params }) => ({
	valid: await isValidResetToken(params.token)
});

export const actions: Actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
		}
		if (password !== data.get('confirm')) return fail(400, { error: 'Passwords do not match.' });
		if (!(await resetPassword(params.token, password))) {
			return fail(400, { error: 'This reset link is invalid or has expired.' });
		}
		return { done: true };
	}
};
