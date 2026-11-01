import { extractLink, waitForMail } from '../helpers/inbucket';
import { expect, test } from './fixtures';

test.describe('with a German browser', () => {
	test.use({ locale: 'de-CH' });

	test('negotiates German from Accept-Language', async ({ page }) => {
		await page.goto('/admin/login');
		await expect(page.locator('html')).toHaveAttribute('lang', 'de');
		await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
		await expect(page.getByLabel('Passwort', { exact: true })).toBeVisible();
	});

	test('sends the password reset mail in German', async ({ page, user }) => {
		await page.goto('/admin/forgot-password');
		await page.getByLabel('E-Mail').fill(user.email);
		await page.getByRole('button', { name: 'Link senden' }).click();
		await expect(page.getByRole('status')).toContainText('haben wir Ihnen einen Link gesendet');

		const mail = await waitForMail(user.email);
		expect(mail.subject).toBe('Ticketbox-Passwort zurücksetzen');
		expect(extractLink(mail.body.text)).toContain('/api/auth/reset-password/');
	});
});

test('switching the language is remembered in a cookie', async ({ page, context }) => {
	await page.goto('/admin/login');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

	await page.getByRole('button', { name: 'Language' }).click();
	await page.getByRole('menuitem', { name: 'Deutsch' }).click();
	await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();

	const cookies = await context.cookies();
	expect(cookies.find((c) => c.name === 'PARAGLIDE_LOCALE')?.value).toBe('de');

	// The choice wins over Accept-Language (en) on later visits.
	await page.goto('/admin/forgot-password');
	await expect(page.getByRole('heading', { name: 'Passwort zurücksetzen' })).toBeVisible();
});

test('translates the admin area', async ({ page, context, user, tenant }) => {
	await context.addCookies([{ name: 'PARAGLIDE_LOCALE', value: 'de', url: 'http://localhost:4180' }]);
	await page.goto('/admin/login');
	await page.getByLabel('E-Mail').fill(user.email);
	await page.getByLabel('Passwort', { exact: true }).fill(user.password);
	await page.getByRole('button', { name: 'Anmelden' }).click();

	await expect(page.getByRole('heading', { name: 'Veranstalter' })).toBeVisible();
	await expect(page.getByText('Inhaber')).toBeVisible();
	await expect(page.getByRole('link', { name: new RegExp(tenant.name) })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
});
