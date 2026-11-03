import { error, fail } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { getSeatPlan, saveSeatPlan } from '#lib/server/seat-plans.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner' as const, 'admin' as const];

export const load: PageServerLoad = async ({ params, locals }) => {
	const tenant = await requireTenant(locals.user, params.tenant, ROLES);
	const plan = await getSeatPlan(tenant.id, params.planId);
	if (!plan) error(404, m.not_found());
	return { plan };
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		let input: unknown;
		try {
			input = JSON.parse(String((await request.formData()).get('plan') ?? ''));
		} catch {
			return fail(400, { error: 'invalid' as const });
		}
		const result = await saveSeatPlan(tenant.id, params.planId, input);
		if (!result) error(404, m.not_found());
		if (!result.ok) return fail(400, { error: result.error, seats: result.seats ?? [] });
		return { saved: true };
	}
};
