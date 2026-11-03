import { error, fail } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import {
	categoryToForm,
	createCategory,
	deleteCategory,
	listCategories,
	moveCategory,
	updateCategory
} from '#lib/server/categories.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner' as const, 'admin' as const];

export const load: PageServerLoad = async ({ parent }) => {
	const { tenant, event } = await parent();
	const categories = await listCategories(tenant.id, event.id);
	return { categories: categories.map((category) => ({ ...category, values: categoryToForm(category) })) };
};

async function formValues(request: Request) {
	return Object.fromEntries(await request.formData()) as Record<string, string>;
}

export const actions: Actions = {
	create: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const values = await formValues(request);
		const result = await createCategory(tenant, params.eventId, values);
		if (!result) error(404, m.not_found());
		if (!result.ok) return fail(400, { action: 'create', values, errors: result.errors });
		return { action: 'create' };
	},

	update: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const values = await formValues(request);
		const result = await updateCategory(tenant, params.eventId, values.id ?? '', values);
		if (!result) error(404, m.not_found());
		if (!result.ok) return fail(400, { action: 'update', id: values.id, values, errors: result.errors });
		return { action: 'update' };
	},

	delete: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const { id = '' } = await formValues(request);
		if (!(await deleteCategory(tenant.id, params.eventId, id))) error(404, m.not_found());
		return { action: 'delete' };
	},

	move: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, ROLES);
		const { id = '', direction } = await formValues(request);
		await moveCategory(tenant.id, params.eventId, id, direction === 'up' ? -1 : 1);
		return { action: 'move' };
	}
};
