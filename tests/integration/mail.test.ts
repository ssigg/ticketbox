import { expect, it } from 'vitest';
import { sendPasswordResetMail } from '../../src/lib/server/mail';
import { extractLink, waitForMail } from '../helpers/inbucket';
import { uniqueEmail } from '../helpers/db';

it('delivers the password reset mail via SMTP', async () => {
	const to = uniqueEmail('mail');
	await sendPasswordResetMail(to, 'http://localhost/reset/abc123');

	const mail = await waitForMail(to);
	expect(mail.subject).toBe('Reset your Ticketbox password');
	expect(extractLink(mail.body.text)).toBe('http://localhost/reset/abc123');
});

it('localizes the password reset mail', async () => {
	const to = uniqueEmail('mail');
	await sendPasswordResetMail(to, 'http://localhost/reset/abc123', 'de');

	const mail = await waitForMail(to);
	expect(mail.subject).toBe('Setze dein Ticketbox-Passwort zurück');
	expect(mail.body.text).toContain('http://localhost/reset/abc123');
});
