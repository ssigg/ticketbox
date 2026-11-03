import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCategory } from '../../src/lib/server/categories';
import { createEvent } from '../../src/lib/server/events';
import {
	createSeatPlan,
	deleteSeatPlan,
	getEventSeating,
	getSeatPlan,
	getSeatPlanImage,
	listSeatPlans,
	saveEventSeating,
	saveSeatPlan,
	setEventSeatPlan
} from '../../src/lib/server/seat-plans';
import { createTenant } from '../helpers/db';

const hall = () => new File([readFileSync('tests/fixtures/hall.png')], 'hall.png', { type: 'image/png' });
const seat = (row: string, number: string, x: number, y = 200) => ({ section: '', row, number, x, y, width: 16, height: 16, rotation: 0 });

async function planOf(tenantId: string) {
	const created = await createSeatPlan(tenantId, 'Saal', hall());
	if (!created.ok) throw new Error('plan not created');
	return created.id;
}

describe('createSeatPlan', () => {
	it('stores the image and reads its size', async () => {
		const tenant = await createTenant();
		const id = await planOf(tenant.id);
		expect(await getSeatPlan(tenant.id, id)).toMatchObject({ name: 'Saal', width: 800, height: 500, seats: [] });
		expect((await getSeatPlanImage(tenant.id, id))?.imageType).toBe('image/png');
	});

	it('rejects non-images, huge files and missing names', async () => {
		const tenant = await createTenant();
		expect(await createSeatPlan(tenant.id, 'X', new File(['hello'], 'a.png'))).toEqual({ ok: false, error: 'image' });
		expect(await createSeatPlan(tenant.id, 'X', new File([new Uint8Array(6 * 1024 * 1024)], 'big.png'))).toEqual({ ok: false, error: 'too_large' });
		expect(await createSeatPlan(tenant.id, ' ', hall())).toEqual({ ok: false, error: 'name' });
	});
});

describe('saveSeatPlan', () => {
	it('keeps seat ids stable and allows swapping labels', async () => {
		const tenant = await createTenant();
		const id = await planOf(tenant.id);
		expect(await saveSeatPlan(tenant.id, id, { name: 'Saal', seatSize: 16, seats: [seat('A', '1', 100), seat('A', '2', 120)] })).toEqual({ ok: true });
		const [a1, a2] = (await getSeatPlan(tenant.id, id))!.seats;

		// Swap numbers and add a seat in one save.
		const result = await saveSeatPlan(tenant.id, id, {
			name: 'Grosser Saal',
			seatSize: 20,
			seats: [
				{ ...seat('A', '2', 100), id: a1.id },
				{ ...seat('A', '1', 120), id: a2.id },
				seat('B', '1', 100, 240)
			]
		});
		expect(result).toEqual({ ok: true });
		const plan = (await getSeatPlan(tenant.id, id))!;
		expect(plan).toMatchObject({ name: 'Grosser Saal', seatSize: 20 });
		expect(plan.seats.find((s) => s.id === a1.id)?.number).toBe('2');
		expect(plan.seats).toHaveLength(3);

		// Seats left out are deleted.
		await saveSeatPlan(tenant.id, id, { name: 'Grosser Saal', seatSize: 20, seats: [{ ...seat('A', '2', 100), id: a1.id }] });
		expect((await getSeatPlan(tenant.id, id))!.seats.map((s) => s.id)).toEqual([a1.id]);
	});

	it('reports duplicates and seats outside the image', async () => {
		const tenant = await createTenant();
		const id = await planOf(tenant.id);
		expect(await saveSeatPlan(tenant.id, id, { name: 'S', seatSize: 16, seats: [seat('A', '1', 10), seat('B', '1', 10), seat('A', '1', 20)] })).toEqual({
			ok: false,
			error: 'duplicates',
			seats: [0, 2]
		});
		expect(await saveSeatPlan(tenant.id, id, { name: 'S', seatSize: 16, seats: [seat('A', '1', 900)] })).toEqual({
			ok: false,
			error: 'out_of_bounds',
			seats: [0]
		});
		expect(await saveSeatPlan(tenant.id, id, { name: 'S', seatSize: 16, seats: [{ ...seat('A', '', 1) }] })).toEqual({ ok: false, error: 'invalid' });
	});

	it('does not reach into other organizers', async () => {
		const tenant = await createTenant();
		const other = await createTenant();
		const id = await planOf(tenant.id);
		expect(await getSeatPlan(other.id, id)).toBeNull();
		expect(await getSeatPlanImage(other.id, id)).toBeNull();
		expect(await saveSeatPlan(other.id, id, { name: 'S', seatSize: 16, seats: [] })).toBeNull();
		expect(await deleteSeatPlan(other.id, id)).toBe('not_found');
	});
});

describe('event seating', () => {
	async function setup() {
		const tenant = await createTenant();
		const planId = await planOf(tenant.id);
		await saveSeatPlan(tenant.id, planId, { name: 'Saal', seatSize: 16, seats: [seat('A', '1', 100), seat('A', '2', 120), seat('A', '3', 140)] });
		const event = await createEvent(tenant, { 'name.de': 'Konzert', slug: 'konzert', startsAt: '2026-12-24T19:30', status: 'draft' });
		if (!event.ok) throw new Error('event not created');
		const category = await createCategory(tenant, event.event.id, { 'name.de': 'Parkett', price: '45', color: '#2563eb' });
		if (!category?.ok) throw new Error('category not created');
		const seats = (await getSeatPlan(tenant.id, planId))!.seats;
		return { tenant, planId, eventId: event.event.id, categoryId: category.category.id, seats };
	}

	it('assigns seats to categories and keeps the plan in use', async () => {
		const { tenant, planId, eventId, categoryId, seats } = await setup();
		expect(await getEventSeating(tenant.id, eventId)).toEqual({ plan: null, assignments: {} });

		expect(await setEventSeatPlan(tenant.id, eventId, planId)).toBe(true);
		expect(await saveEventSeating(tenant.id, eventId, { [seats[0].id]: categoryId, [seats[1].id]: categoryId })).toBe('ok');
		const seating = await getEventSeating(tenant.id, eventId);
		expect(seating?.plan?.id).toBe(planId);
		expect(seating?.assignments).toEqual({ [seats[0].id]: categoryId, [seats[1].id]: categoryId });

		expect(await deleteSeatPlan(tenant.id, planId)).toBe('in_use');
		expect((await listSeatPlans(tenant.id))[0]).toMatchObject({ seatCount: 3, eventCount: 1 });

		// Removing a seat from the plan removes its assignment.
		await saveSeatPlan(tenant.id, planId, { name: 'Saal', seatSize: 16, seats: [{ ...seat('A', '1', 100), id: seats[0].id }] });
		expect((await getEventSeating(tenant.id, eventId))?.assignments).toEqual({ [seats[0].id]: categoryId });
	});

	it('rejects foreign seats and categories, and resets on plan change', async () => {
		const { tenant, planId, eventId, categoryId, seats } = await setup();
		await setEventSeatPlan(tenant.id, eventId, planId);
		const otherPlan = await planOf(tenant.id);
		await saveSeatPlan(tenant.id, otherPlan, { name: 'Andere', seatSize: 16, seats: [seat('X', '1', 50)] });
		const foreignSeat = (await getSeatPlan(tenant.id, otherPlan))!.seats[0].id;

		expect(await saveEventSeating(tenant.id, eventId, { [foreignSeat]: categoryId })).toBe('invalid');
		expect(await saveEventSeating(tenant.id, eventId, { [seats[0].id]: crypto.randomUUID() })).toBe('invalid');

		await saveEventSeating(tenant.id, eventId, { [seats[0].id]: categoryId });
		await setEventSeatPlan(tenant.id, eventId, otherPlan);
		expect(await getEventSeating(tenant.id, eventId)).toMatchObject({ plan: { id: otherPlan }, assignments: {} });

		const stranger = await createTenant();
		expect(await setEventSeatPlan(stranger.id, eventId, null)).toBe(false);
		expect(await setEventSeatPlan(tenant.id, eventId, await planOf(stranger.id))).toBe(false);
	});
});
