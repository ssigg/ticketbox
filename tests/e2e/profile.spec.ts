import { expect, login, test } from './fixtures';

test('changes the password and signs out other sessions', async ({ page, browser, user }) => {
	// A second, independent session for the same user.
	const other = await browser.newContext();
	const otherPage = await other.newPage();
	await login(otherPage, user.email, user.password);
	await expect(otherPage.getByRole('heading', { name: 'Organizers' })).toBeVisible();

	await login(page, user.email, user.password);
	await page.getByRole('link', { name: user.name }).click();
	await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
	await expect(page.getByText(user.email)).toBeVisible();

	await page.getByLabel('Current password').fill(user.password);
	await page.getByLabel('New password').fill('changed-pass-1');
	await page.getByLabel('Repeat password').fill('changed-pass-1');
	await page.getByRole('button', { name: 'Save password' }).click();
	await expect(page.getByRole('status')).toHaveText('Your password was changed.');
	await expect(page.getByLabel('Current password')).toHaveValue('');

	// This session stays signed in, the other one is gone.
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
	await otherPage.reload();
	await expect(otherPage).toHaveURL(/\/admin\/login/);
	await other.close();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await login(page, user.email, 'changed-pass-1');
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
});

test('rejects a wrong current password', async ({ page, user }) => {
	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto('/admin/profile');
	await page.getByLabel('Current password').fill('not-my-password');
	await page.getByLabel('New password').fill('changed-pass-1');
	await page.getByLabel('Repeat password').fill('changed-pass-1');
	await page.getByRole('button', { name: 'Save password' }).click();
	await expect(page.getByRole('alert')).toHaveText('The current password is incorrect.');
});

test('rejects a mismatched confirmation without calling the server', async ({ page, user }) => {
	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto('/admin/profile');
	await page.getByLabel('Current password').fill(user.password);
	await page.getByLabel('New password').fill('changed-pass-1');
	await page.getByLabel('Repeat password').fill('changed-pass-2');
	await page.getByRole('button', { name: 'Save password' }).click();
	await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
});

test('requires sign-in', async ({ page }) => {
	await page.goto('/admin/profile');
	await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin%2Fprofile/);
});
