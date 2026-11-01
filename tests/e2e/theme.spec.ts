import { expect, test } from '@playwright/test';

test('follows the OS color scheme by default', async ({ browser }) => {
	const context = await browser.newContext({ colorScheme: 'dark' });
	const page = await context.newPage();
	await page.goto('/admin/login');
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
	await context.close();
});

test('toggles dark mode and remembers the choice', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/admin/login');
	const html = page.locator('html');
	await expect(html).not.toHaveClass(/\bdark\b/);

	await page.getByRole('button', { name: 'Switch to dark mode' }).click();
	await expect(html).toHaveClass(/\bdark\b/);

	await page.reload();
	await expect(html).toHaveClass(/\bdark\b/);

	await page.getByRole('button', { name: 'Switch to light mode' }).click();
	await expect(html).not.toHaveClass(/\bdark\b/);
});
