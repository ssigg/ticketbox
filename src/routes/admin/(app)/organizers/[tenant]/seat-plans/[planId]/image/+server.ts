import { error } from '@sveltejs/kit';
import { requireTenant } from '#lib/server/access.ts';
import { getSeatPlanImage } from '#lib/server/seat-plans.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, request }) => {
	const tenant = await requireTenant(locals.user, params.tenant, ['owner', 'admin']);
	const image = await getSeatPlanImage(tenant.id, params.planId);
	if (!image) error(404);
	const etag = `"${image.updatedAt.getTime()}"`;
	const headers = { 'content-type': image.imageType, etag, 'cache-control': 'private, no-cache' };
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
	return new Response(new Uint8Array(image.image), { headers });
};
