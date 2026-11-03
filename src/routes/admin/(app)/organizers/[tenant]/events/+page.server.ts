import { requireTenant } from '#lib/server/access.ts';
import { listEvents } from '#lib/server/events.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const tenant = await requireTenant(locals.user, params.tenant, ['owner', 'admin']);
	return { events: await listEvents(tenant.id) };
};
