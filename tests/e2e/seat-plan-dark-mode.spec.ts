import { readFileSync } from 'node:fs';
import { createSeatPlan } from '../../src/lib/server/seat-plans';
import { expect, login, test } from './fixtures';

test.use({ colorScheme: 'dark' });

test('converts a drawn plan for dark mode, with the original one click away', async ({ page, user, tenant }) => {
	const plan = await createSeatPlan(tenant.id, 'Stadtsaal', new File([readFileSync('tests/fixtures/plan.png')], 'plan.png'));
	if (!plan.ok) throw new Error('plan not created');

	await login(page, user.email, user.password);
	await expect(page.getByRole('heading', { name: 'Organizers' })).toBeVisible();
	await page.goto(`/admin/organizers/${tenant.slug}/seat-plans/${plan.id}`);

	const map = page.getByRole('application', { name: 'Seat plan' });
	await expect(map).toHaveAttribute('data-image', 'dark');
	await expect(map.locator('image')).toHaveAttribute('href', /^blob:/);

	await page.getByRole('button', { name: 'Show original image' }).click();
	await expect(map).toHaveAttribute('data-image', 'original');
	await expect(map.locator('image')).toHaveAttribute('href', /\/image\?v=/);
	await page.getByRole('button', { name: 'Show original image' }).click();
	await expect(map).toHaveAttribute('data-image', 'dark');

	// Light mode shows the original, and there's nothing to switch.
	await page.getByRole('button', { name: 'Switch to light mode' }).click();
	await expect(map).toHaveAttribute('data-image', 'original');
	await expect(page.getByRole('button', { name: 'Show original image' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Switch to dark mode' }).click();
	await expect(map).toHaveAttribute('data-image', 'dark');

	// "Never" keeps the original in dark mode, also after saving.
	await page.getByRole('combobox', { name: 'Adapt to dark mode' }).click();
	await page.getByRole('option', { name: 'Never' }).click();
	await expect(map).toHaveAttribute('data-image', 'original');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('combobox', { name: 'Adapt to dark mode' })).toHaveText('Never');
	await expect(map).toHaveAttribute('data-image', 'original');
});
