import { error, fail } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { eventToForm, updateEvent } from '#lib/server/events.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { event, tenant } = await parent();
	return { values: eventToForm(event, tenant.timezone) };
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ['owner', 'admin']);
		const values = Object.fromEntries(await request.formData()) as Record<string, string>;
		const result = await updateEvent(tenant, params.eventId, values);
		if (!result) error(404, m.not_found());
		if (!result.ok) return fail(400, { values, errors: result.errors });
		return { saved: true };
	}
};
