import { describe, expect, it } from 'vitest';
import {
	createCategory,
	deleteCategory,
	listCategories,
	moveCategory,
	parseCategoryForm,
	updateCategory
} from '../../src/lib/server/categories';
import { createEvent } from '../../src/lib/server/events';
import { createTenant } from '../helpers/db';

async function eventOf(tenant: Awaited<ReturnType<typeof createTenant>>) {
	const result = await createEvent(tenant, { 'name.de': 'Konzert', slug: 'konzert', startsAt: '2026-12-24T19:30', status: 'draft' });
	if (!result.ok) throw new Error('event not created');
	return result.event;
}

const vip = { 'name.de': 'VIP', 'name.en': '', price: '89.50', color: '#dc2626' };

describe('parseCategoryForm', () => {
	it('parses price and keeps only filled names', () => {
		expect(parseCategoryForm(vip, 'de')).toEqual({ ok: true, input: { name: { de: 'VIP' }, price: 8950, color: '#dc2626' } });
	});

	it('rejects invalid fields', () => {
		expect(parseCategoryForm({ 'name.de': '', price: '-5', color: 'red' }, 'de')).toEqual({
			ok: false,
			errors: { 'name.de': true, price: true, color: true }
		});
	});
});

describe('categories', () => {
	it('creates, lists in order, updates and deletes', async () => {
		const tenant = await createTenant();
		const event = await eventOf(tenant);
		await createCategory(tenant, event.id, vip);
		await createCategory(tenant, event.id, { ...vip, 'name.de': 'Parkett', price: '45' });
		await createCategory(tenant, event.id, { ...vip, 'name.de': 'Balkon', price: '30' });
		expect((await listCategories(tenant.id, event.id)).map((c) => c.name.de)).toEqual(['VIP', 'Parkett', 'Balkon']);

		const [first, second] = await listCategories(tenant.id, event.id);
		expect(await updateCategory(tenant, event.id, second.id, { ...vip, 'name.de': 'Parkett', price: '49.00' })).toMatchObject({
			ok: true,
			category: { price: 4900 }
		});

		expect(await moveCategory(tenant.id, event.id, first.id, 1)).toBe(true);
		expect((await listCategories(tenant.id, event.id)).map((c) => c.name.de)).toEqual(['Parkett', 'VIP', 'Balkon']);
		expect(await moveCategory(tenant.id, event.id, second.id, -1)).toBe(false);

		expect(await deleteCategory(tenant.id, event.id, first.id)).toMatchObject({ id: first.id });
		expect((await listCategories(tenant.id, event.id)).map((c) => c.name.de)).toEqual(['Parkett', 'Balkon']);
	});

	it('does not reach into other organizers', async () => {
		const a = await createTenant();
		const b = await createTenant();
		const event = await eventOf(a);
		const created = await createCategory(a, event.id, vip);
		if (!created?.ok) throw new Error('not created');

		expect(await listCategories(b.id, event.id)).toEqual([]);
		expect(await createCategory(b, event.id, vip)).toBeNull();
		expect(await updateCategory(b, event.id, created.category.id, vip)).toBeNull();
		expect(await deleteCategory(b.id, event.id, created.category.id)).toBeNull();
		expect(await listCategories(a.id, event.id)).toHaveLength(1);
	});
});
