import { describe, expect, it } from 'vitest';
import { createEvent, eventToForm, getEvent, listEvents, parseEventForm, updateEvent } from '../../src/lib/server/events';
import { createTenant } from '../helpers/db';

const zurich = { id: 'x', defaultLocale: 'de', timezone: 'Europe/Zurich' };
const valid = {
	'name.de': 'Weihnachtskonzert',
	'name.en': '',
	'description.de': 'Mit Chor',
	slug: 'weihnachtskonzert',
	venue: 'Stadtkirche',
	startsAt: '2026-12-24T19:30',
	salesStart: '',
	salesEnd: '',
	status: 'draft'
};

describe('parseEventForm', () => {
	it('converts local times in the organizer time zone and drops empty translations', () => {
		const result = parseEventForm({ ...valid, salesStart: '2026-11-01T10:00', salesEnd: '2026-12-24T18:00' }, zurich);
		expect(result).toEqual({
			ok: true,
			input: {
				slug: 'weihnachtskonzert',
				name: { de: 'Weihnachtskonzert' },
				description: { de: 'Mit Chor' },
				venue: 'Stadtkirche',
				startsAt: new Date('2026-12-24T18:30:00Z'),
				salesStart: new Date('2026-11-01T09:00:00Z'),
				salesEnd: new Date('2026-12-24T17:00:00Z'),
				status: 'draft'
			}
		});
	});

	it('requires the name in the default language only', () => {
		expect(parseEventForm({ ...valid, 'name.de': '', 'name.en': 'Christmas' }, zurich)).toEqual({ ok: false, errors: { 'name.de': true } });
		expect(parseEventForm({ ...valid, 'name.de': '', 'name.en': 'Christmas' }, { ...zurich, defaultLocale: 'en' }).ok).toBe(true);
	});

	it('reports every invalid field', () => {
		const result = parseEventForm(
			{ ...valid, slug: 'No Slug', startsAt: '', salesStart: '2026-12-01T10:00', salesEnd: '2026-11-01T10:00', status: 'live' },
			zurich
		);
		expect(result).toEqual({ ok: false, errors: { slug: true, startsAt: true, salesEnd: true, status: true } });
	});

	it('round-trips through the form values', async () => {
		const tenant = await createTenant();
		const created = await createEvent(tenant, { ...valid, salesEnd: '2026-12-24T18:00' });
		if (!created.ok) throw new Error('not created');
		expect(eventToForm(created.event, tenant.timezone)).toMatchObject({ ...valid, salesEnd: '2026-12-24T18:00' });
	});
});

describe('events', () => {
	it('creates, lists and updates events of one organizer', async () => {
		const tenant = await createTenant();
		const first = await createEvent(tenant, { ...valid, slug: 'b-event', startsAt: '2027-01-02T20:00' });
		const second = await createEvent(tenant, { ...valid, slug: 'a-event', startsAt: '2027-01-01T20:00' });
		expect(first.ok && second.ok).toBe(true);
		expect((await listEvents(tenant.id)).map((e) => e.slug)).toEqual(['a-event', 'b-event']);

		if (!first.ok) return;
		const updated = await updateEvent(tenant, first.event.id, { ...valid, slug: 'b-event', venue: 'Aula', status: 'onsale' });
		expect(updated).toMatchObject({ ok: true, event: { venue: 'Aula', status: 'onsale' } });
	});

	it('keeps slugs unique per organizer only', async () => {
		const a = await createTenant();
		const b = await createTenant();
		expect((await createEvent(a, valid)).ok).toBe(true);
		expect(await createEvent(a, valid)).toEqual({ ok: false, errors: { slugTaken: true } });
		expect((await createEvent(b, valid)).ok).toBe(true);

		const other = await createEvent(a, { ...valid, slug: 'other' });
		if (!other.ok) throw new Error('not created');
		expect(await updateEvent(a, other.event.id, valid)).toEqual({ ok: false, errors: { slugTaken: true } });
	});

	it('does not reach into other organizers', async () => {
		const a = await createTenant();
		const b = await createTenant();
		const created = await createEvent(a, valid);
		if (!created.ok) throw new Error('not created');

		expect(await getEvent(b.id, created.event.id)).toBeNull();
		expect(await updateEvent(b, created.event.id, valid)).toBeNull();
		expect(await getEvent(a.id, 'not-a-uuid')).toBeNull();
	});
});
