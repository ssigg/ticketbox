import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createCategory } from '../../src/lib/server/categories';
import { createEvent } from '../../src/lib/server/events';
import { detectSeatBoxes } from '../../src/lib/seat-detection/boxes';
import { createSeatPlan, saveSeatPlan, setEventSeatPlan } from '../../src/lib/server/seat-plans';
import { expect, login, test } from './fixtures';

// Default 1280 × 720 window: the plan (800 × 1095) is taller than the map's scroll area.
test('scrolls the plan while dragging, so one box can cover every seat', async ({ page, user, tenant }) => {
	const file = readFileSync('tests/fixtures/plan.png');
	const plan = await createSeatPlan(tenant.id, 'Stadtsaal', new File([file], 'plan.png'));
	if (!plan.ok) throw new Error('plan not created');
	const boxes = detectSeatBoxes(PNG.sync.read(file), { example: { x: 22, y: 158 } });
	await saveSeatPlan(tenant.id, plan.id, {
		name: 'Stadtsaal',
		seatSize: 25,
		seats: boxes.map((b, i) => ({ section: '', row: '', number: String(i + 1), x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0 }))
	});
	const event = await createEvent(tenant, { 'name.de': 'Konzert', slug: 'konzert', startsAt: '2026-12-24T19:30', status: 'draft' });
	if (!event.ok) throw new Error('event not created');
	const category = await createCategory(tenant, event.event.id, { 'name.de': 'Parkett', price: '45', color: '#2563eb' });
	if (!category?.ok) throw new Error('category not created');
	await setEventSeatPlan(tenant.id, event.event.id, plan.id);

	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/events/${event.event.id}/seating`);
	await expect(page.getByTestId('count-none')).toHaveText('248');

	const map = page.getByRole('application', { name: 'Seat plan' });
	const scroller = map.locator('..');
	await scroller.scrollIntoViewIfNeeded();
	const area = (await scroller.boundingBox())!;
	const svg = (await map.boundingBox())!;
	expect(svg.height).toBeGreaterThan(area.height); // the plan really doesn't fit

	// From the empty corner above seat 1 to the bottom-right edge of the map; hold until it has scrolled down.
	const scale = svg.width / 800;
	await page.mouse.move(svg.x + 3 * scale, svg.y + 120 * scale);
	await page.mouse.down();
	await page.mouse.move(area.x + area.width - 5, area.y + area.height - 5, { steps: 10 });
	await expect
		.poll(() => scroller.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1), { timeout: 10_000 })
		.toBe(true);
	await page.mouse.up();

	await expect(page.getByTestId(`count-${category.category.id}`)).toHaveText('248');
	await expect(page.getByTestId('count-none')).toHaveText('0');
});
