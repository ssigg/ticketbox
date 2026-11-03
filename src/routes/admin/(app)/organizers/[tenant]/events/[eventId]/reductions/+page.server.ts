import { error, fail } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { listCategories } from '#lib/server/categories.ts';
import {
	deleteReduction,
	listReductions,
	moveReduction,
	reductionToForm,
	saveReduction,
	type ReductionFormValues
} from '#lib/server/reductions.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner' as const, 'admin' as const];

export const load: PageServerLoad = async ({ parent }) => {
	const { tenant, event } = await parent();
	const [categories, reductions] = await Promise.all([listCategories(tenant.id, event.id), listReductions(tenant.id, event.id)]);
	return {
		categories,
		reductions: reductions.map((reduction) => ({ ...reduction, values: reductionToForm(reduction) }))
	};
};

async function formValues(request: Request): Promise<ReductionFormValues> {
	const data = await request.formData();
	const values: ReductionFormValues = {};
	for (const [key, value] of data) if (key !== 'categoryIds') values[key] = String(value);
	values.categoryIds = data.getAll('categoryIds').map(String);
	return values;
}

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const values = await formValues(request);
		const id = typeof values.id === 'string' && values.id ? values.id : undefined;
		const result = await saveReduction(tenant, params.eventId, id, values);
		if (!result) error(404, m.not_found());
		if (!result.ok) return fail(400, { errors: result.errors });
		return { saved: true };
	},

	delete: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const { id } = await formValues(request);
		if (!(await deleteReduction(tenant.id, params.eventId, String(id ?? '')))) error(404, m.not_found());
		return { deleted: true };
	},

	move: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const { id, direction } = await formValues(request);
		await moveReduction(tenant.id, params.eventId, String(id ?? ''), direction === 'up' ? -1 : 1);
		return { moved: true };
	}
};
