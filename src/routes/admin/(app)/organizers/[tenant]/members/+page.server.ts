import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requireTenant } from '#lib/server/access.ts';
import { roleEnum } from '#lib/server/db/schema.ts';
import { changeRole, inviteMember, listMembers, removeMember, resendInvitation } from '#lib/server/members.ts';
import type { Actions, PageServerLoad } from './$types';

const OWNER = ['owner' as const];

export const load: PageServerLoad = async ({ params, locals }) => {
	const tenant = await requireTenant(locals.user, params.tenant, OWNER);
	return { members: await listMembers(tenant.id) };
};

const inviteInput = z.object({
	email: z.email().max(200),
	name: z.string().trim().min(1).max(100),
	role: z.enum(roleEnum.enumValues)
});
const memberInput = z.object({ userId: z.string().min(1) });
const roleInput = memberInput.extend({ role: z.enum(roleEnum.enumValues) });

/** The member the form refers to, so feedback can name them (and removed members still have a name). */
async function findMember(tenantId: string, userId: string) {
	return (await listMembers(tenantId)).find((member) => member.userId === userId);
}

export const actions: Actions = {
	invite: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, OWNER);
		const form = Object.fromEntries(await request.formData());
		const parsed = inviteInput.safeParse(form);
		if (!parsed.success) {
			return fail(400, { action: 'invite', values: form, invalid: parsed.error.issues.map((i) => String(i.path[0])) });
		}
		const result = await inviteMember({ tenant, ...parsed.data, invitedBy: locals.user!.name });
		if (result === 'already_member') return fail(400, { action: 'invite', values: form, alreadyMember: parsed.data.email });
		return { action: 'invite', result, email: parsed.data.email };
	},

	changeRole: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, OWNER);
		const parsed = roleInput.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { action: 'changeRole' });
		const member = await findMember(tenant.id, parsed.data.userId);
		const result = await changeRole(tenant.id, parsed.data.userId, parsed.data.role);
		if (result !== 'ok') return fail(400, { action: 'changeRole', error: result });
		// Owners who step down can no longer see this page.
		if (parsed.data.userId === locals.user!.id && parsed.data.role !== 'owner' && !locals.user!.isSuperadmin) {
			redirect(303, `/admin/organizers/${tenant.slug}`);
		}
		return { action: 'changeRole', name: member!.name };
	},

	remove: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, OWNER);
		const parsed = memberInput.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { action: 'remove' });
		const member = await findMember(tenant.id, parsed.data.userId);
		const result = await removeMember(tenant.id, parsed.data.userId);
		if (result !== 'ok') return fail(400, { action: 'remove', error: result });
		if (parsed.data.userId === locals.user!.id && !locals.user!.isSuperadmin) redirect(303, '/admin/organizers');
		return { action: 'remove', name: member!.name };
	},

	resend: async ({ request, params, locals }) => {
		const tenant = await requireTenant(locals.user, params.tenant, OWNER);
		const parsed = memberInput.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { action: 'resend' });
		const sent = await resendInvitation({ tenant, userId: parsed.data.userId, invitedBy: locals.user!.name });
		if (!sent) return fail(400, { action: 'resend' });
		return { action: 'resend', email: (await findMember(tenant.id, parsed.data.userId))!.email };
	}
};
