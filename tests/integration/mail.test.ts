import { expect, it } from 'vitest';
import { sendPasswordResetMail } from '../../src/lib/server/mail';
import { extractLink, waitForMail } from '../helpers/inbucket';
import { uniqueEmail } from '../helpers/db';

it('delivers the password reset mail via SMTP', async () => {
	const to = uniqueEmail('mail');
	await sendPasswordResetMail(to, 'abc123');

	const mail = await waitForMail(to);
	expect(mail.subject).toBe('Reset your Ticketbox password');
	expect(extractLink(mail.body.text)).toBe(`${process.env.ORIGIN}/admin/reset-password/abc123`);
});
