import { fail, redirect } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { createEvent } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner' as const, 'admin' as const];

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireTenant(locals.user, params.tenant, ROLES);
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const values = Object.fromEntries(await request.formData()) as Record<string, string>;
		const result = await createEvent(tenant, values);
		if (!result.ok) return fail(400, { values, errors: result.errors });
		redirect(303, `/admin/organizers/${tenant.slug}/events/${result.event.id}?created`);
	}
};
