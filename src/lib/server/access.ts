import { error } from '@sveltejs/kit';
import type { Role } from './db/schema';
import { tenantsForUser, type SessionUser } from './auth';
import { m } from '../paraglide/messages.js';

/**
 * The organizer behind `slug` if `user` may access it with one of `roles`.
 * Unknown or inaccessible organizers are a 404, so slugs are not discoverable;
 * a known organizer with an insufficient role is a 403.
 */
export async function requireTenant(user: SessionUser | null, slug: string, roles?: Role[]) {
	if (!user) error(401, m.forbidden());
	const tenant = (await tenantsForUser(user)).find((t) => t.slug === slug);
	if (!tenant) error(404, m.not_found());
	if (roles && !roles.includes(tenant.role)) error(403, m.forbidden());
	return tenant;
}
