import { requireTenant } from '#lib/server/access.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => ({
	tenant: await requireTenant(locals.user, params.tenant)
});
