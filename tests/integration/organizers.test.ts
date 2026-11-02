import { describe, expect, it } from 'vitest';
import { createOrganizer } from '../../src/lib/server/organizers';

const slug = () => `org-${crypto.randomUUID().slice(0, 8)}`;

describe('createOrganizer', () => {
	it('creates an organizer with normalized input', async () => {
		const s = slug();
		const result = await createOrganizer({ name: '  Kellerbühne ', slug: s.toUpperCase(), defaultLocale: 'de', currency: 'CHF' });
		expect(result).toMatchObject({ ok: true, organizer: { name: 'Kellerbühne', slug: s, defaultLocale: 'de', currency: 'CHF' } });
	});

	it('rejects a taken slug', async () => {
		const s = slug();
		await createOrganizer({ name: 'First', slug: s, defaultLocale: 'en', currency: 'CHF' });
		const second = await createOrganizer({ name: 'Second', slug: s, defaultLocale: 'en', currency: 'CHF' });
		expect(second).toEqual({ ok: false, errors: { slugTaken: true } });
	});

	it('reports invalid fields', async () => {
		const result = await createOrganizer({
			name: ' ',
			slug: 'Not a slug!',
			// @ts-expect-error invalid on purpose
			defaultLocale: 'fr',
			// @ts-expect-error invalid on purpose
			currency: 'USD'
		});
		expect(result).toEqual({ ok: false, errors: { name: true, slug: true, defaultLocale: true, currency: true } });
	});
});
