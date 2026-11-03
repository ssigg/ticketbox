import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createSeatPlan, getSeatPlan } from '../../src/lib/server/seat-plans';
import { expect, login, test } from './fixtures';

// The whole plan (800 × 1095) must be on screen; mouse events outside the viewport are dropped.
test.use({ viewport: { width: 1280, height: 1900 } });

async function clickImage(page: Page, x: number, y: number) {
	const box = (await page.getByRole('application', { name: 'Seat plan' }).boundingBox())!;
	const scale = box.width / 800;
	await page.mouse.click(box.x + x * scale, box.y + y * scale);
}

test('detects the seats of a drawn plan, fixes misreads and names the rows', async ({ page, user, tenant }) => {
	test.setTimeout(120_000);
	const plan = await createSeatPlan(tenant.id, 'Stadtsaal', new File([readFileSync('tests/fixtures/plan.png')], 'plan.png'));
	if (!plan.ok) throw new Error('plan not created');

	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/seat-plans/${plan.id}`);

	// An empty plan opens with the Detect tool; click seat 1.
	await expect(page.getByRole('button', { name: 'Detect' })).toHaveAttribute('aria-pressed', 'true');
	await clickImage(page, 22, 158);
	await expect(page.getByText('248 seats')).toBeVisible({ timeout: 90_000 });

	// Misreads are listed with the number their neighbours imply; apply them all.
	const review = page.getByRole('list', { name: 'Check' });
	await expect(review.getByRole('listitem').first()).toBeVisible();
	await page.getByRole('button', { name: 'Apply all suggestions' }).click();
	await expect(page.getByRole('button', { name: 'Apply all suggestions' })).toHaveCount(0);

	// Name rows: the tool is active after detection; click a seat of rows 1 and 2.
	await expect(page.getByRole('button', { name: 'Name rows' })).toHaveAttribute('aria-pressed', 'true');
	await page.getByLabel('Next row name').fill('1');
	await clickImage(page, 22, 158); // row 1, seat 1
	await clickImage(page, 187, 212); // row 2, seat 19
	await expect(page.getByLabel('Next row name')).toHaveValue('3');

	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();

	const saved = (await getSeatPlan(tenant.id, plan.id))!.seats;
	expect(saved).toHaveLength(248);
	expect(new Set(saved.map((s) => s.number)).size).toBe(248);
	expect(saved.filter((s) => s.row === '1').map((s) => Number(s.number)).sort((a, b) => a - b)).toEqual(
		Array.from({ length: 18 }, (_, i) => i + 1)
	);
	expect(saved.filter((s) => s.row === '2').map((s) => Number(s.number)).sort((a, b) => a - b)).toEqual(
		Array.from({ length: 11 }, (_, i) => i + 19)
	);
});
