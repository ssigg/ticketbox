import { imageSize } from 'image-size';
import { and, asc, count, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { categories, eventSeats, events, seatPlans, seats } from './db/schema';
import { ownedEventId } from './events';
import { duplicateLabels } from '../seat-plan';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SEATS = 5000;
const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/** Plan metadata without the image bytes. */
const planColumns = {
	id: seatPlans.id,
	tenantId: seatPlans.tenantId,
	name: seatPlans.name,
	width: seatPlans.width,
	height: seatPlans.height,
	seatSize: seatPlans.seatSize,
	updatedAt: seatPlans.updatedAt
};

export async function listSeatPlans(tenantId: string) {
	const plans = await db.select(planColumns).from(seatPlans).where(eq(seatPlans.tenantId, tenantId)).orderBy(asc(seatPlans.name));
	if (!plans.length) return [];
	const ids = plans.map((p) => p.id);
	const seatCounts = await db
		.select({ id: seats.seatPlanId, n: count() })
		.from(seats)
		.where(inArray(seats.seatPlanId, ids))
		.groupBy(seats.seatPlanId);
	const eventCounts = await db
		.select({ id: events.seatPlanId, n: count() })
		.from(events)
		.where(inArray(events.seatPlanId, ids))
		.groupBy(events.seatPlanId);
	return plans.map((plan) => ({
		...plan,
		seatCount: seatCounts.find((c) => c.id === plan.id)?.n ?? 0,
		eventCount: eventCounts.find((c) => c.id === plan.id)?.n ?? 0
	}));
}

export type CreateSeatPlanResult = { ok: true; id: string } | { ok: false; error: 'name' | 'image' | 'too_large' };

/** Accepts PNG, JPEG and WebP up to 5 MB; the dimensions are read from the file itself. */
export async function createSeatPlan(tenantId: string, name: string, file: File | null): Promise<CreateSeatPlanResult> {
	const trimmed = name.trim();
	if (!trimmed || trimmed.length > 100) return { ok: false, error: 'name' };
	if (!file || file.size === 0) return { ok: false, error: 'image' };
	if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'too_large' };
	const image = Buffer.from(await file.arrayBuffer());
	let size: ReturnType<typeof imageSize>;
	try {
		size = imageSize(image);
	} catch {
		return { ok: false, error: 'image' };
	}
	const imageType = size.type && IMAGE_TYPES[size.type];
	if (!imageType || !size.width || !size.height) return { ok: false, error: 'image' };

	const [plan] = await db
		.insert(seatPlans)
		.values({
			tenantId,
			name: trimmed,
			image,
			imageType,
			width: size.width,
			height: size.height,
			// About 1.5 % of the larger side is a good starting point for typical hall plans.
			seatSize: Math.max(6, Math.round(Math.max(size.width, size.height) * 0.015))
		})
		.returning({ id: seatPlans.id });
	return { ok: true, id: plan.id };
}

export async function getSeatPlan(tenantId: string, planId: string) {
	if (!UUID.test(planId)) return null;
	const [plan] = await db
		.select(planColumns)
		.from(seatPlans)
		.where(and(eq(seatPlans.id, planId), eq(seatPlans.tenantId, tenantId)));
	if (!plan) return null;
	const planSeats = await db
		.select()
		.from(seats)
		.where(eq(seats.seatPlanId, planId))
		.orderBy(asc(seats.section), asc(seats.row), asc(seats.y), asc(seats.x));
	return { ...plan, seats: planSeats };
}

export async function getSeatPlanImage(tenantId: string, planId: string) {
	if (!UUID.test(planId)) return null;
	const [row] = await db
		.select({ image: seatPlans.image, imageType: seatPlans.imageType, updatedAt: seatPlans.updatedAt })
		.from(seatPlans)
		.where(and(eq(seatPlans.id, planId), eq(seatPlans.tenantId, tenantId)));
	return row ?? null;
}

const seatInput = z.object({
	id: z.string().regex(UUID).optional(),
	section: z.string().trim().max(50),
	row: z.string().trim().max(50),
	number: z.string().trim().min(1).max(20),
	x: z.number().finite(),
	y: z.number().finite()
});
const planInput = z.object({
	name: z.string().trim().min(1).max(100),
	seatSize: z.number().int().min(2).max(500),
	seats: z.array(seatInput).max(MAX_SEATS)
});
export type SeatPlanInput = z.input<typeof planInput>;

export type SaveSeatPlanResult =
	| { ok: true }
	| { ok: false; error: 'invalid' | 'duplicates' | 'out_of_bounds'; seats?: number[] }
	| null;

/**
 * Replaces the plan's seats: seats with an `id` are updated, the others created, missing ones deleted.
 * Seat ids stay stable so events keep their category assignments.
 */
export async function saveSeatPlan(tenantId: string, planId: string, input: unknown): Promise<SaveSeatPlanResult> {
	const plan = await getSeatPlan(tenantId, planId);
	if (!plan) return null;
	const parsed = planInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: 'invalid' };
	const { name, seatSize, seats: list } = parsed.data;

	const duplicates = duplicateLabels(list);
	if (duplicates.length) return { ok: false, error: 'duplicates', seats: duplicates };
	const outside = list.flatMap((s, i) => (s.x < 0 || s.y < 0 || s.x > plan.width || s.y > plan.height ? [i] : []));
	if (outside.length) return { ok: false, error: 'out_of_bounds', seats: outside };

	const existingIds = new Set(plan.seats.map((s) => s.id));
	const kept = list.filter((s): s is typeof s & { id: string } => !!s.id && existingIds.has(s.id));
	const created = list.filter((s) => !s.id || !existingIds.has(s.id)).map(({ id: _, ...s }) => s);

	await db.transaction(async (tx) => {
		await tx.update(seatPlans).set({ name, seatSize }).where(eq(seatPlans.id, planId));
		await tx
			.delete(seats)
			.where(and(eq(seats.seatPlanId, planId), kept.length ? notInArray(seats.id, kept.map((s) => s.id)) : undefined));
		if (kept.length) {
			// One statement for all moved/relabelled seats; the deferred unique constraint allows label swaps.
			await tx.execute(sql`
				update ${seats} as s
				set section = v.section, row = v.row, number = v.number, x = v.x, y = v.y
				from jsonb_to_recordset(${JSON.stringify(kept)}::jsonb)
					as v(id uuid, section text, row text, number text, x float8, y float8)
				where s.id = v.id and s.seat_plan_id = ${planId}
			`);
		}
		for (let i = 0; i < created.length; i += 1000) {
			await tx.insert(seats).values(created.slice(i, i + 1000).map((s) => ({ ...s, seatPlanId: planId })));
		}
	});
	return { ok: true };
}

export type DeleteSeatPlanResult = 'ok' | 'not_found' | 'in_use';

export async function deleteSeatPlan(tenantId: string, planId: string): Promise<DeleteSeatPlanResult> {
	if (!UUID.test(planId)) return 'not_found';
	try {
		const deleted = await db
			.delete(seatPlans)
			.where(and(eq(seatPlans.id, planId), eq(seatPlans.tenantId, tenantId)))
			.returning({ id: seatPlans.id });
		return deleted.length ? 'ok' : 'not_found';
	} catch (e) {
		const err = e as { code?: string; cause?: { code?: string } };
		if (err.code === '23503' || err.cause?.code === '23503') return 'in_use';
		throw e;
	}
}

// ── Seat plan of an event ──

/** The event's plan with every seat's category (null = not for sale). */
export async function getEventSeating(tenantId: string, eventId: string) {
	const id = await ownedEventId(tenantId, eventId);
	if (!id) return null;
	const [event] = await db.select({ seatPlanId: events.seatPlanId }).from(events).where(eq(events.id, id));
	if (!event.seatPlanId) return { plan: null, assignments: {} as Record<string, string> };
	const plan = await getSeatPlan(tenantId, event.seatPlanId);
	const rows = await db.select().from(eventSeats).where(eq(eventSeats.eventId, id));
	return { plan, assignments: Object.fromEntries(rows.map((r) => [r.seatId, r.categoryId])) as Record<string, string> };
}

/** Switches the event to another plan (or none); category assignments of the old plan are dropped. */
export async function setEventSeatPlan(tenantId: string, eventId: string, planId: string | null): Promise<boolean> {
	const id = await ownedEventId(tenantId, eventId);
	if (!id) return false;
	if (planId && !(await getSeatPlan(tenantId, planId))) return false;
	await db.transaction(async (tx) => {
		const [current] = await tx.select({ seatPlanId: events.seatPlanId }).from(events).where(eq(events.id, id));
		if (current.seatPlanId === planId) return;
		await tx.delete(eventSeats).where(eq(eventSeats.eventId, id));
		await tx.update(events).set({ seatPlanId: planId }).where(eq(events.id, id));
	});
	return true;
}

/** Replaces the event's seat → category assignments. Seats left out are not for sale. */
export async function saveEventSeating(
	tenantId: string,
	eventId: string,
	assignments: Record<string, string>
): Promise<'ok' | 'not_found' | 'invalid'> {
	const id = await ownedEventId(tenantId, eventId);
	if (!id) return 'not_found';
	const [event] = await db.select({ seatPlanId: events.seatPlanId }).from(events).where(eq(events.id, id));
	if (!event.seatPlanId) return 'invalid';

	const planSeatIds = new Set(
		(await db.select({ id: seats.id }).from(seats).where(eq(seats.seatPlanId, event.seatPlanId))).map((s) => s.id)
	);
	const categoryIds = new Set(
		(await db.select({ id: categories.id }).from(categories).where(eq(categories.eventId, id))).map((c) => c.id)
	);
	const entries = Object.entries(assignments);
	if (entries.some(([seatId, categoryId]) => !planSeatIds.has(seatId) || !categoryIds.has(categoryId))) return 'invalid';

	await db.transaction(async (tx) => {
		await tx.delete(eventSeats).where(eq(eventSeats.eventId, id));
		for (let i = 0; i < entries.length; i += 1000) {
			await tx
				.insert(eventSeats)
				.values(entries.slice(i, i + 1000).map(([seatId, categoryId]) => ({ eventId: id, seatId, categoryId })));
		}
	});
	return 'ok';
}

