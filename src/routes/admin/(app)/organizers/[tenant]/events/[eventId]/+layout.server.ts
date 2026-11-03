import { error } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { getEvent } from '#lib/server/events.ts';
import { m } from '#lib/paraglide/messages.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	const tenant = await requireTenant(locals.user, params.tenant, ['owner', 'admin']);
	const event = await getEvent(tenant.id, params.eventId);
	if (!event) error(404, m.not_found());
	return { event };
};
