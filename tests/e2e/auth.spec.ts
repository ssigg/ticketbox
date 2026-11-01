import { createTenant } from '../helpers/db';
import { extractLink, waitForMail } from '../helpers/inbucket';
import { expect, login, test } from './fixtures';

test('redirects anonymous visitors to the login page', async ({ page }) => {
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin/);
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('logs in, shows own organizers and logs out', async ({ page, user, tenant }) => {
	await login(page, user.email, user.password);

	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await expect(page.getByTestId('current-user')).toHaveText('Erika Muster');
	await page.getByRole('link', { name: tenant.name }).click();
	await expect(page.getByRole('heading', { name: tenant.name })).toBeVisible();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/admin\/login/);
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/login/);
});

test('shows an error for wrong credentials', async ({ page, user }) => {
	await login(page, user.email, 'wrong-password');
	await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
	await expect(page.getByLabel('Email')).toHaveValue(user.email);
});

test('returns to the originally requested page after login', async ({ page, user, tenant }) => {
	await page.goto(`/admin/${tenant.slug}`);
	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Password').fill(user.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/${tenant.slug}$`));
});

test('hides organizers the user is not a member of', async ({ page, user }) => {
	const foreign = await createTenant('Foreign Theater');
	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await expect(page.getByText('Foreign Theater')).toHaveCount(0);

	const response = await page.goto(`/admin/${foreign.slug}`);
	expect(response?.status()).toBe(404);
});

test('resets the password via email link', async ({ page, user }) => {
	await page.goto('/admin/login');
	await page.getByRole('link', { name: 'Forgot password?' }).click();
	// Both pages have an Email field; make sure we fill the right one.
	await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
	await page.getByLabel('Email').fill(user.email);
	await page.getByRole('button', { name: 'Send reset link' }).click();
	await expect(page.getByRole('status')).toContainText('we sent a reset link');

	const mail = await waitForMail(user.email);
	await page.goto(extractLink(mail.body.text));
	await page.getByLabel('New password').fill('brand-new-pass');
	await page.getByLabel('Repeat password').fill('brand-new-pass');
	await page.getByRole('button', { name: 'Save password' }).click();
	await expect(page.getByRole('status')).toHaveText('Your password was changed.');

	await login(page, user.email, 'brand-new-pass');
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
});
