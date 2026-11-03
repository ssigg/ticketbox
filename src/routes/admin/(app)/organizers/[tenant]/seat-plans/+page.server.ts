import { fail, redirect } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { createSeatPlan, deleteSeatPlan, listSeatPlans } from '#lib/server/seat-plans.ts';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner' as const, 'admin' as const];

export const load: PageServerLoad = async ({ params, locals }) => {
	const tenant = await requireTenant(locals.user, params.tenant, ROLES);
	return { plans: await listSeatPlans(tenant.id) };
};

export const actions: Actions = {
	create: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const data = await request.formData();
		const image = data.get('image');
		const result = await createSeatPlan(tenant.id, String(data.get('name') ?? ''), image instanceof File ? image : null);
		if (!result.ok) return fail(400, { action: 'create', error: result.error });
		redirect(303, `/admin/organizers/${tenant.slug}/seat-plans/${result.id}`);
	},

	delete: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const result = await deleteSeatPlan(tenant.id, String((await request.formData()).get('id') ?? ''));
		if (result !== 'ok') return fail(400, { action: 'delete', error: result });
		return { action: 'delete' };
	}
};
