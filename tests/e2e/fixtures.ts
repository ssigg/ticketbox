import { test as base, expect, type Page } from '@playwright/test';
import { addMembership, createTenant, createUser } from '../helpers/db';

type TestUser = Awaited<ReturnType<typeof createUser>>;

export const test = base.extend<{ user: TestUser; tenant: Awaited<ReturnType<typeof createTenant>> }>({
	// The e2e server trusts X-Forwarded-For (ADDRESS_HEADER in .env.test). Giving every test its
	// own address keeps Better Auth's per-IP rate limits from leaking between parallel tests.
	extraHTTPHeaders: async ({}, use) => {
		const n = () => Math.floor(Math.random() * 254) + 1;
		await use({ 'x-forwarded-for': `10.${n()}.${n()}.${n()}` });
	},
	tenant: async ({}, use) => {
		await use(await createTenant(`Theater ${crypto.randomUUID().slice(0, 4)}`));
	},
	user: async ({ tenant }, use) => {
		const user = await createUser({ name: 'Erika Muster' });
		await addMembership(user.id, tenant.id, 'owner');
		await use(user);
	}
});

export async function login(page: Page, email: string, password: string) {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

export { expect };
