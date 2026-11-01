import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent }) => {
	const { tenants } = await parent();
	const tenant = tenants.find((t) => t.slug === params.tenant);
	// 404 rather than 403 so tenant slugs are not discoverable.
	if (!tenant) error(404, 'Not found');
	return { tenant };
};
