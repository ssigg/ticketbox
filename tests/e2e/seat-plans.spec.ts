import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createCategory } from '../../src/lib/server/categories';
import { createEvent } from '../../src/lib/server/events';
import { createSeatPlan, saveSeatPlan } from '../../src/lib/server/seat-plans';
import { expect, login, test } from './fixtures';

// Tall enough that the whole map is on screen; mouse events outside the viewport are dropped.
test.use({ viewport: { width: 1280, height: 1100 } });

/** Screen position of an image pixel on the seat map (the test image is 800 × 500). */
async function at(page: Page, x: number, y: number) {
	const box = (await page.getByRole('application', { name: 'Seat plan' }).boundingBox())!;
	const scale = box.width / 800;
	return { x: box.x + x * scale, y: box.y + y * scale };
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
	const a = await at(page, ...from);
	const b = await at(page, ...to);
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
	await page.mouse.move(b.x, b.y, { steps: 5 });
	await page.mouse.up();
}

test('uploads a seat plan and places rows of seats', async ({ page, user, tenant }) => {
	await login(page, user.email, user.password);
	await page.getByRole('link', { name: new RegExp(tenant.name) }).click();
	await page.getByRole('link', { name: 'Seat plans' }).click();

	await page.getByRole('button', { name: 'New seat plan' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name').fill('Grosser Saal');
	await dialog.getByLabel('Image').setInputFiles('tests/fixtures/hall.png');
	await dialog.getByRole('button', { name: 'Upload' }).click();
	await expect(page.getByRole('heading', { name: 'Grosser Saal' })).toBeVisible();

	await page.getByRole('button', { name: 'Row', exact: true }).click();
	await page.getByLabel('Seats', { exact: true }).fill('10');
	await drag(page, [150, 200], [650, 200]);
	await drag(page, [150, 260], [650, 260]);
	await expect(page.getByText('20 seats')).toBeVisible();
	// The second row got the next row label automatically.
	await expect(page.getByRole('application').locator('title', { hasText: 'Row B, Seat 10' })).toHaveCount(1);

	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');
	await page.reload();
	await expect(page.getByText('20 seats')).toBeVisible();

	// Give two seats the same label → the save is refused.
	await page.getByRole('button', { name: 'Select', exact: true }).click();
	const seatB1 = await at(page, 150, 260);
	await page.mouse.click(seatB1.x, seatB1.y);
	await page.getByLabel('Row', { exact: true }).fill('A');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('alert')).toContainText('same section, row and number');

	// Delete the selected seat with the keyboard; now it saves.
	await page.getByRole('application').focus();
	await page.keyboard.press('Delete');
	await expect(page.getByText('19 seats')).toBeVisible();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');
});

test('assigns the seats of an event to categories', async ({ page, user, tenant }) => {
	const plan = await createSeatPlan(tenant.id, 'Saal', new File([readFileSync('tests/fixtures/hall.png')], 'hall.png'));
	if (!plan.ok) throw new Error('plan not created');
	await saveSeatPlan(tenant.id, plan.id, {
		name: 'Saal',
		seatSize: 20,
		seats: [100, 200, 300, 400, 500, 600].flatMap((x) => [
			{ section: '', row: 'A', number: String(x / 100), x, y: 200, width: 20, height: 20, rotation: 0 },
			{ section: '', row: 'B', number: String(x / 100), x, y: 300, width: 20, height: 20, rotation: 0 }
		])
	});
	const event = await createEvent(tenant, { 'name.de': 'Konzert', slug: 'konzert', startsAt: '2026-12-24T19:30', status: 'draft' });
	if (!event.ok) throw new Error('event not created');
	const parkett = await createCategory(tenant, event.event.id, { 'name.de': 'Parkett', price: '45', color: '#2563eb' });
	const vip = await createCategory(tenant, event.event.id, { 'name.de': 'VIP', price: '90', color: '#dc2626' });
	if (!parkett?.ok || !vip?.ok) throw new Error('categories not created');

	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/events/${event.event.id}/seating`);
	await expect(page.getByText('This event has no seat plan yet.')).toBeVisible();
	await page.getByRole('combobox', { name: 'Seat plan' }).click();
	await page.getByRole('option', { name: /Saal/ }).click();
	await page.getByRole('button', { name: 'Use seat plan' }).click();

	// Everything starts as not for sale; paint row B as Parkett (box) and one seat as VIP (click).
	await expect(page.getByTestId('count-none')).toHaveText('12');
	await drag(page, [50, 280], [650, 320]);
	await expect(page.getByTestId(`count-${parkett.category.id}`)).toHaveText('6');
	await page.getByRole('radio', { name: /VIP/ }).click();
	const seat = await at(page, 300, 200);
	await page.mouse.click(seat.x, seat.y);
	await expect(page.getByTestId(`count-${vip.category.id}`)).toHaveText('1');
	await expect(page.getByTestId('count-none')).toHaveText('5');

	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');
	await page.reload();
	await expect(page.getByTestId(`count-${parkett.category.id}`)).toHaveText('6');
	await expect(page.getByTestId(`count-${vip.category.id}`)).toHaveText('1');
});
