import { createCategory } from '../../src/lib/server/categories';
import { createEvent } from '../../src/lib/server/events';
import { expect, login, test } from './fixtures';

test('manages reductions and shows the resulting prices', async ({ page, user, tenant }) => {
	const event = await createEvent(tenant, { 'name.de': 'Konzert', slug: 'konzert', startsAt: '2026-12-24T19:30', status: 'draft' });
	if (!event.ok) throw new Error('event not created');
	await createCategory(tenant, event.event.id, { 'name.de': 'Parkett', price: '45', color: '#2563eb' });
	await createCategory(tenant, event.event.id, { 'name.de': 'Balkon', price: '29.50', color: '#dc2626' });

	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/events/${event.event.id}`);
	await page.getByRole('link', { name: 'Reductions' }).click();
	await expect(page.getByText('No reductions yet.')).toBeVisible();

	// 33 % for everyone
	await page.getByRole('button', { name: 'New reduction' }).click();
	let dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name (DE)').fill('Studierende');
	await dialog.getByLabel('Name (EN)').fill('Students');
	await dialog.getByLabel('Reduction (%)').fill('33');
	await dialog.getByRole('button', { name: 'Create' }).click();
	await expect(dialog).toBeHidden();

	// CHF 10 off, only for the Parkett
	await page.getByRole('button', { name: 'New reduction' }).click();
	dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name (DE)').fill('AHV');
	await dialog.getByLabel('Amount in CHF').check();
	await dialog.getByLabel('Reduction (CHF)').fill('10');
	await dialog.getByLabel('Selected categories').check();
	await dialog.getByRole('button', { name: 'Create' }).click();
	await expect(dialog.getByRole('alert')).toHaveText('Please select at least one category.');
	await dialog.getByLabel('Parkett').check();
	await dialog.getByRole('button', { name: 'Create' }).click();
	await expect(dialog).toBeHidden();

	const list = page.getByRole('table').first();
	await expect(list.getByRole('row', { name: /Students/ })).toContainText('33%');
	await expect(list.getByRole('row', { name: /AHV/ })).toContainText('CHF 10.00');
	await expect(list.getByRole('row', { name: /AHV/ })).toContainText('Parkett');

	const overview = page.getByRole('table', { name: 'Price overview' });
	await expect(overview.getByRole('row', { name: /Parkett/ })).toHaveText(/Parkett\s*CHF\s45.00\s*CHF\s30.15\s*CHF\s35.00/);
	// 29.50 − 33 % = 19.765 → rounded to 19.75; AHV does not apply to the balcony.
	await expect(overview.getByRole('row', { name: /Balkon/ })).toHaveText(/Balkon\s*CHF\s29.50\s*CHF\s19.75\s*–/);

	await page.getByRole('button', { name: 'Delete: AHV' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
	await expect(list.getByRole('row', { name: /AHV/ })).toHaveCount(0);
});
