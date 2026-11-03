import { createEvent } from '../../src/lib/server/events';
import { expect, login, test } from './fixtures';

test('manages the price categories of an event', async ({ page, user, tenant }) => {
	const event = await createEvent(tenant, { 'name.de': 'Konzert', slug: 'konzert', startsAt: '2026-12-24T19:30', status: 'draft' });
	if (!event.ok) throw new Error('event not created');

	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/events/${event.event.id}`);
	await page.getByRole('link', { name: 'Categories' }).click();
	await expect(page.getByText('No categories yet.')).toBeVisible();

	for (const [name, price, en] of [['Parkett', '45', 'Stalls'], ['Balkon', '29.5', '']]) {
		await page.getByRole('button', { name: 'New category' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Name (DE)').fill(name);
		if (en) await dialog.getByLabel('Name (EN)').fill(en);
		await dialog.getByLabel('Price (CHF)').fill(price);
		await dialog.getByRole('button', { name: 'Create' }).click();
		await expect(dialog).toBeHidden();
	}

	// English UI shows the English name where there is one, otherwise the German one.
	const rows = page.getByRole('row');
	await expect(rows.nth(1)).toContainText('Stalls');
	await expect(rows.nth(1)).toContainText('CHF 45.00');
	await expect(rows.nth(2)).toContainText('Balkon');
	await expect(rows.nth(2)).toContainText('CHF 29.50');

	// Invalid price
	await page.getByRole('button', { name: 'Edit: Balkon' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByLabel('Price (CHF)')).toHaveValue('29.50');
	await dialog.getByLabel('Price (CHF)').fill('thirty');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(dialog.getByRole('alert')).toHaveText('Please enter a price like 45 or 45.50.');
	await dialog.getByLabel('Price (CHF)').fill('32');
	// The radio itself is visually hidden behind its colour swatch.
	await dialog.getByTitle('Green').click();
	await expect(dialog.getByRole('radio', { name: 'Green' })).toBeChecked();
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(rows.nth(2)).toContainText('CHF 32.00');

	await page.getByRole('button', { name: 'Move up: Balkon' }).click();
	await expect(rows.nth(1)).toContainText('Balkon');

	await page.getByRole('button', { name: 'Delete: Stalls' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('row', { name: /Stalls/ })).toHaveCount(0);
	await expect(page.getByRole('row')).toHaveCount(2);
});
