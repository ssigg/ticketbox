import { redirect } from '@sveltejs/kit';
import { tenantsForUser } from '#lib/server/auth.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/admin/login');
	return { user: locals.user, tenants: await tenantsForUser(locals.user) };
};
