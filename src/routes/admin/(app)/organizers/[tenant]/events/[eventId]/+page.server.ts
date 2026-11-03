import { error, fail } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { eventToForm, getEvent, updateEvent } from '#lib/server/events.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner' as const, 'admin' as const];

export const load: PageServerLoad = async ({ params, locals }) => {
	const tenant = await requireTenant(locals.user, params.tenant, ROLES);
	const event = await getEvent(tenant.id, params.eventId);
	if (!event) error(404, m.not_found());
	return { event, values: eventToForm(event, tenant.timezone) };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const values = Object.fromEntries(await request.formData()) as Record<string, string>;
		const result = await updateEvent(tenant, params.eventId, values);
		if (!result) error(404, m.not_found());
		if (!result.ok) return fail(400, { values, errors: result.errors });
		return { saved: true };
	}
};
