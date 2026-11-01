import { createPasswordReset } from '#lib/server/auth.ts';
import { sendPasswordResetMail } from '#lib/server/mail.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const email = String((await request.formData()).get('email') ?? '');
		const reset = await createPasswordReset(email);
		if (reset) await sendPasswordResetMail(reset.user.email, reset.token);
		// Same answer whether or not the account exists.
		return { sent: true };
	}
};
