import { z } from 'zod';
import { db } from './db';
import { tenants, type Tenant } from './db/schema';
import { locales } from '../paraglide/runtime.js';

export const CURRENCIES = ['CHF', 'EUR'] as const;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const organizerInput = z.object({
	name: z.string().trim().min(1).max(100),
	slug: z.string().trim().toLowerCase().min(2).max(60).regex(SLUG_PATTERN),
	defaultLocale: z.enum(locales),
	currency: z.enum(CURRENCIES)
});
export type OrganizerInput = z.input<typeof organizerInput>;

export type CreateOrganizerResult =
	| { ok: true; organizer: Tenant }
	| { ok: false; errors: Partial<Record<keyof OrganizerInput | 'slugTaken', true>> };

export async function createOrganizer(input: OrganizerInput): Promise<CreateOrganizerResult> {
	const parsed = organizerInput.safeParse(input);
	if (!parsed.success) {
		const errors: Partial<Record<keyof OrganizerInput, true>> = {};
		for (const issue of parsed.error.issues) errors[issue.path[0] as keyof OrganizerInput] = true;
		return { ok: false, errors };
	}
	const [organizer] = await db
		.insert(tenants)
		.values(parsed.data)
		.onConflictDoNothing({ target: tenants.slug })
		.returning();
	if (!organizer) return { ok: false, errors: { slugTaken: true } };
	return { ok: true, organizer };
}
