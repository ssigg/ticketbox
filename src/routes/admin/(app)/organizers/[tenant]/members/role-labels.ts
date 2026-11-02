import { m } from '#lib/paraglide/messages.js';

export const ROLES = ['owner', 'admin', 'boxoffice'] as const;
export type Role = (typeof ROLES)[number];

export const roleLabel: Record<Role, () => string> = {
	owner: m.role_owner,
	admin: m.role_admin,
	boxoffice: m.role_boxoffice
};

export const roleDescription: Record<Role, () => string> = {
	owner: m.role_owner_description,
	admin: m.role_admin_description,
	boxoffice: m.role_boxoffice_description
};
