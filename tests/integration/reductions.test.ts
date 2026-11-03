import { describe, expect, it } from 'vitest';
import { createCategory, deleteCategory } from '../../src/lib/server/categories';
import { createEvent } from '../../src/lib/server/events';
import { deleteReduction, listReductions, moveReduction, parseReductionForm, reductionToForm, saveReduction } from '../../src/lib/server/reductions';
import { createTenant } from '../helpers/db';

async function setup() {
	const tenant = await createTenant();
	const event = await createEvent(tenant, { 'name.de': 'Konzert', slug: 'konzert', startsAt: '2026-12-24T19:30', status: 'draft' });
	if (!event.ok) throw new Error('event not created');
	const parkett = await createCategory(tenant, event.event.id, { 'name.de': 'Parkett', price: '45', color: '#2563eb' });
	const balkon = await createCategory(tenant, event.event.id, { 'name.de': 'Balkon', price: '30', color: '#dc2626' });
	if (!parkett?.ok || !balkon?.ok) throw new Error('categories not created');
	return { tenant, eventId: event.event.id, parkett: parkett.category.id, balkon: balkon.category.id };
}

const student = { 'name.de': 'Studierende', kind: 'percent', value: '20', scope: 'all' };

describe('parseReductionForm', () => {
	it('stores percentages as basis points and amounts as minor units', () => {
		expect(parseReductionForm({ ...student, value: '12.5' }, 'de', [])).toMatchObject({ ok: true, input: { kind: 'percent', value: 1250 } });
		expect(parseReductionForm({ ...student, kind: 'absolute', value: '5,50' }, 'de', [])).toMatchObject({ ok: true, input: { kind: 'absolute', value: 550 } });
	});

	it('rejects out-of-range values and unknown categories', () => {
		expect(parseReductionForm({ ...student, value: '120' }, 'de', [])).toEqual({ ok: false, errors: { value: true } });
		expect(parseReductionForm({ ...student, value: '0' }, 'de', [])).toEqual({ ok: false, errors: { value: true } });
		expect(parseReductionForm({ ...student, scope: 'selected', categoryIds: [] }, 'de', ['a'])).toEqual({ ok: false, errors: { categoryIds: true } });
		expect(parseReductionForm({ ...student, scope: 'selected', categoryIds: ['x'] }, 'de', ['a'])).toEqual({ ok: false, errors: { categoryIds: true } });
	});
});

describe('reductions', () => {
	it('saves, restricts to categories, edits, reorders and deletes', async () => {
		const { tenant, eventId, parkett, balkon } = await setup();
		await saveReduction(tenant, eventId, undefined, student);
		const created = await saveReduction(tenant, eventId, undefined, {
			'name.de': 'AHV',
			kind: 'absolute',
			value: '10',
			scope: 'selected',
			categoryIds: [parkett]
		});
		if (!created?.ok) throw new Error('not created');

		let list = await listReductions(tenant.id, eventId);
		expect(list.map((r) => [r.name.de, r.allCategories, r.categoryIds])).toEqual([
			['Studierende', true, []],
			['AHV', false, [parkett]]
		]);
		expect(reductionToForm(list[1])).toMatchObject({ kind: 'absolute', value: '10.00', scope: 'selected', categoryIds: [parkett] });

		await saveReduction(tenant, eventId, created.reduction.id, { ...reductionToForm(list[1]), categoryIds: [parkett, balkon] });
		expect((await listReductions(tenant.id, eventId))[1].categoryIds.sort()).toEqual([parkett, balkon].sort());

		expect(await moveReduction(tenant.id, eventId, created.reduction.id, -1)).toBe(true);
		list = await listReductions(tenant.id, eventId);
		expect(list.map((r) => r.name.de)).toEqual(['AHV', 'Studierende']);

		// Deleting a category drops it from restrictions.
		await deleteCategory(tenant.id, eventId, balkon);
		expect((await listReductions(tenant.id, eventId))[0].categoryIds).toEqual([parkett]);

		expect(await deleteReduction(tenant.id, eventId, created.reduction.id)).not.toBeNull();
		expect(await listReductions(tenant.id, eventId)).toHaveLength(1);
	});

	it('does not reach into other organizers', async () => {
		const { tenant, eventId } = await setup();
		const other = await createTenant();
		const created = await saveReduction(tenant, eventId, undefined, student);
		if (!created?.ok) throw new Error('not created');

		expect(await listReductions(other.id, eventId)).toEqual([]);
		expect(await saveReduction(other, eventId, undefined, student)).toBeNull();
		expect(await saveReduction(other, eventId, created.reduction.id, student)).toBeNull();
		expect(await deleteReduction(other.id, eventId, created.reduction.id)).toBeNull();
	});
});
