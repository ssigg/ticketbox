import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { eventStatusEnum, events, type Event, type LocalizedText, type Tenant } from './db/schema';
import { SLUG_PATTERN } from './organizers';
import { fromLocalInput, toLocalInput } from '../zoned-time';
import { locales } from '../paraglide/runtime.js';

type EventTenant = Pick<Tenant, 'id' | 'defaultLocale' | 'timezone'>;

/** Field names as used in the form; per-locale fields are `name.de`, `description.en`, … */
export type EventFormValues = Record<string, string>;
export type EventFormErrors = Partial<Record<string, true>>;

export type EventInput = Pick<Event, 'slug' | 'name' | 'description' | 'venue' | 'startsAt' | 'salesStart' | 'salesEnd' | 'status'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates submitted form values. Times are wall-clock times in the organizer's time zone.
 * The name is required in the organizer's default language; other languages fall back to it.
 */
export function parseEventForm(values: EventFormValues, tenant: EventTenant):
	| { ok: true; input: EventInput }
	| { ok: false; errors: EventFormErrors } {
	const errors: EventFormErrors = {};
	const text = (key: string) => (values[key] ?? '').trim();

	const name: LocalizedText = {};
	const description: LocalizedText = {};
	for (const locale of locales) {
		if (text(`name.${locale}`)) name[locale] = text(`name.${locale}`);
		if (text(`description.${locale}`)) description[locale] = text(`description.${locale}`);
		if ((name[locale]?.length ?? 0) > 200) errors[`name.${locale}`] = true;
		if ((description[locale]?.length ?? 0) > 5000) errors[`description.${locale}`] = true;
	}
	if (!name[tenant.defaultLocale]) errors[`name.${tenant.defaultLocale}`] = true;

	const slug = text('slug').toLowerCase();
	if (!z.string().min(2).max(60).regex(SLUG_PATTERN).safeParse(slug).success) errors.slug = true;

	const venue = text('venue');
	if (venue.length > 200) errors.venue = true;

	const time = (key: string, required: boolean) => {
		const raw = text(key);
		if (!raw) {
			if (required) errors[key] = true;
			return null;
		}
		const date = fromLocalInput(raw, tenant.timezone);
		if (!date) errors[key] = true;
		return date;
	};
	const startsAt = time('startsAt', true);
	const salesStart = time('salesStart', false);
	const salesEnd = time('salesEnd', false);
	if (salesStart && salesEnd && salesEnd <= salesStart) errors.salesEnd = true;

	const status = z.enum(eventStatusEnum.enumValues).safeParse(text('status'));
	if (!status.success) errors.status = true;

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		input: { slug, name, description, venue, startsAt: startsAt!, salesStart, salesEnd, status: status.data! }
	};
}

/** An event as form values, for editing. */
export function eventToForm(event: Event, timeZone: string): EventFormValues {
	const values: EventFormValues = {
		slug: event.slug,
		venue: event.venue,
		status: event.status,
		startsAt: toLocalInput(event.startsAt, timeZone),
		salesStart: event.salesStart ? toLocalInput(event.salesStart, timeZone) : '',
		salesEnd: event.salesEnd ? toLocalInput(event.salesEnd, timeZone) : ''
	};
	for (const locale of locales) {
		values[`name.${locale}`] = event.name[locale] ?? '';
		values[`description.${locale}`] = event.description[locale] ?? '';
	}
	return values;
}

/** The event's id if it belongs to the organizer; queries on an event's parts go through this. */
export async function ownedEventId(tenantId: string, eventId: string): Promise<string | null> {
	if (!UUID.test(eventId)) return null;
	const [event] = await db
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)));
	return event?.id ?? null;
}

export function listEvents(tenantId: string) {
	return db.select().from(events).where(eq(events.tenantId, tenantId)).orderBy(asc(events.startsAt));
}

export async function getEvent(tenantId: string, eventId: string): Promise<Event | null> {
	if (!UUID.test(eventId)) return null;
	const [event] = await db
		.select()
		.from(events)
		.where(and(eq(events.tenantId, tenantId), eq(events.id, eventId)));
	return event ?? null;
}

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

export type SaveEventResult = { ok: true; event: Event } | { ok: false; errors: EventFormErrors };

export async function createEvent(tenant: EventTenant, values: EventFormValues): Promise<SaveEventResult> {
	const parsed = parseEventForm(values, tenant);
	if (!parsed.ok) return parsed;
	try {
		const [event] = await db.insert(events).values({ ...parsed.input, tenantId: tenant.id }).returning();
		return { ok: true, event };
	} catch (e) {
		if (isUniqueViolation(e)) return { ok: false, errors: { slugTaken: true } };
		throw e;
	}
}

export async function updateEvent(
	tenant: EventTenant,
	eventId: string,
	values: EventFormValues
): Promise<SaveEventResult | null> {
	const parsed = parseEventForm(values, tenant);
	if (!parsed.ok) return parsed;
	if (!UUID.test(eventId)) return null;
	try {
		const [event] = await db
			.update(events)
			.set(parsed.input)
			.where(and(eq(events.tenantId, tenant.id), eq(events.id, eventId)))
			.returning();
		return event ? { ok: true, event } : null;
	} catch (e) {
		if (isUniqueViolation(e)) return { ok: false, errors: { slugTaken: true } };
		throw e;
	}
}
