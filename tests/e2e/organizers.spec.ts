import { createUser } from '../helpers/db';
import { expect, login, test } from './fixtures';

test('superadmins create organizers', async ({ page }) => {
	const admin = await createUser({ isSuperadmin: true, name: 'Super Admin' });
	const name = `Kellerbühne ${crypto.randomUUID().slice(0, 4)}`;

	await login(page, admin.email, admin.password);
	await page.getByRole('button', { name: 'New organizer' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name').fill(name);
	await expect(dialog.getByLabel('Address (slug)')).toHaveValue(/^kellerbuehne-[a-z0-9]{4}$/);
	await dialog.getByRole('button', { name: 'Create' }).click();

	await expect(page).toHaveURL(/\/admin\/organizers\/kellerbuehne-[a-z0-9]{4}$/);
	await expect(page.getByRole('heading', { name })).toBeVisible();
});

test('shows an error for a taken slug', async ({ page, tenant }) => {
	const admin = await createUser({ isSuperadmin: true });
	await login(page, admin.email, admin.password);
	await page.getByRole('button', { name: 'New organizer' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name').fill('Duplicate');
	await dialog.getByLabel('Address (slug)').fill(tenant.slug);
	await dialog.getByRole('button', { name: 'Create' }).click();

	await expect(dialog.getByRole('alert')).toHaveText('This address is already taken.');
	await expect(dialog).toBeVisible();
});

test('regular users cannot create organizers', async ({ page, user }) => {
	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'New organizer' })).toHaveCount(0);

	// The action is protected on the server too, not just hidden.
	const res = await page.request.post('/admin/organizers?/create', {
		form: { name: 'Sneaky', slug: 'sneaky', defaultLocale: 'en', currency: 'CHF' },
		headers: { origin: 'http://localhost:4180' }
	});
	expect(res.status()).toBe(403);
});
