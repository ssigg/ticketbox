import { error, fail } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { listCategories } from '#lib/server/categories.ts';
import { getEventSeating, listSeatPlans, saveEventSeating, setEventSeatPlan } from '#lib/server/seat-plans.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner' as const, 'admin' as const];

export const load: PageServerLoad = async ({ parent }) => {
	const { tenant, event } = await parent();
	const [seating, categories, plans] = await Promise.all([
		getEventSeating(tenant.id, event.id),
		listCategories(tenant.id, event.id),
		listSeatPlans(tenant.id)
	]);
	if (!seating) error(404, m.not_found());
	return { seating, categories, plans: plans.map(({ id, name, seatCount }) => ({ id, name, seatCount })) };
};

export const actions: Actions = {
	setPlan: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const planId = String((await request.formData()).get('planId') ?? '');
		if (!(await setEventSeatPlan(tenant.id, params.eventId, planId || null))) error(404, m.not_found());
		return { planChanged: true };
	},

	save: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		let assignments: Record<string, string>;
		try {
			assignments = JSON.parse(String((await request.formData()).get('assignments') ?? ''));
		} catch {
			return fail(400, { error: 'invalid' });
		}
		const result = await saveEventSeating(tenant.id, params.eventId, assignments);
		if (result === 'not_found') error(404, m.not_found());
		if (result === 'invalid') return fail(400, { error: 'invalid' });
		return { saved: true };
	}
};
