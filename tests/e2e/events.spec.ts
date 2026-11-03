import { createEvent } from '../../src/lib/server/events';
import { addMembership, createUser } from '../helpers/db';
import { expect, login, test } from './fixtures';

// The fixture organizer has German as default language and Europe/Zurich as time zone.

test('creates and edits an event', async ({ page, user, tenant }) => {
	await login(page, user.email, user.password);
	await page.getByRole('link', { name: new RegExp(tenant.name) }).click();
	await page.getByRole('link', { name: 'Events' }).click();
	await expect(page.getByText('No events yet.')).toBeVisible();

	await page.getByRole('link', { name: 'New event' }).click();
	await page.getByLabel('Name (DE)').fill('Weihnachtskonzert 2026');
	await expect(page.getByLabel('Address (slug)')).toHaveValue('weihnachtskonzert-2026');
	await page.getByLabel('Name (EN)').fill('Christmas concert 2026');
	await page.getByLabel('Venue').fill('Stadtkirche');
	await page.getByLabel('Starts at').fill('2026-12-24T19:30');
	await page.getByRole('button', { name: 'Create' }).click();

	await expect(page.getByRole('heading', { name: 'Christmas concert 2026' })).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Event saved.');
	await expect(page.getByLabel('Starts at')).toHaveValue('2026-12-24T19:30');

	await page.getByLabel('Venue').fill('Aula');
	await page.getByRole('combobox', { name: 'Status' }).click();
	await page.getByRole('option', { name: /On sale/ }).click();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toHaveText('Event saved.');

	await page.getByRole('link', { name: 'Events', exact: true }).first().click();
	const row = page.getByRole('row', { name: /Christmas concert 2026/ });
	await expect(row).toContainText('Dec 24, 2026, 7:30');
	await expect(row).toContainText('Aula');
	await expect(row).toContainText('On sale');
});

test('validates the form', async ({ page, user, tenant }) => {
	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/events/new`);

	await createEvent(tenant, { 'name.de': 'Bestehend', slug: 'concert', startsAt: '2026-12-01T20:00', status: 'draft' });

	await page.getByLabel('Name (DE)').fill('Konzert');
	await page.getByLabel('Address (slug)').fill('concert');
	await page.getByLabel('Starts at').fill('2026-12-24T19:30');
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('alert')).toHaveText('Another event already uses this address.');

	await page.getByLabel('Address (slug)').fill('concert-2');
	await page.getByLabel('Sales start').fill('2026-12-01T10:00');
	await page.getByLabel('Sales end').fill('2026-11-01T10:00');
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByRole('alert')).toHaveText('The sales end must be after the sales start.');
	// Input is kept.
	await expect(page.getByLabel('Name (DE)')).toHaveValue('Konzert');
});

test('box office members cannot manage events', async ({ page, tenant }) => {
	const cashier = await createUser({ name: 'Karin Kasse' });
	await addMembership(cashier.id, tenant.id, 'boxoffice');
	await login(page, cashier.email, cashier.password);
	await page.getByRole('link', { name: new RegExp(tenant.name) }).click();
	await expect(page.getByRole('heading', { name: tenant.name })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Events' })).toHaveCount(0);
	expect((await page.goto(`/admin/organizers/${tenant.slug}/events`))?.status()).toBe(403);
	expect((await page.goto(`/admin/organizers/${tenant.slug}/events/new`))?.status()).toBe(403);
});
