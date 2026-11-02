import { describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER, auth } from '../../src/lib/server/auth';
import { changeRole, inviteMember, listMembers, removeMember, resendInvitation } from '../../src/lib/server/members';
import { addMembership, createTenant, createUser, uniqueEmail } from '../helpers/db';
import { extractLink, mailCount, waitForMail } from '../helpers/inbucket';

async function setPasswordVia(link: string, password: string) {
	const token = new URL(link).pathname.split('/').pop()!;
	const res = await auth.handler(
		new Request(`${process.env.ORIGIN}/api/auth/reset-password`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: process.env.ORIGIN!, [CLIENT_IP_HEADER]: '10.9.9.9' },
			body: JSON.stringify({ token, newPassword: password })
		})
	);
	return res.status;
}

describe('inviteMember', () => {
	it('creates an account for unknown emails and mails a 7-day password link', async () => {
		const tenant = await createTenant('Kellerbühne');
		const email = uniqueEmail('invitee');
		const result = await inviteMember({ tenant, email, name: 'Ina Vitee', role: 'admin', invitedBy: 'Olga Owner' });
		expect(result).toBe('invited');

		const [member] = await listMembers(tenant.id);
		expect(member).toMatchObject({ email, name: 'Ina Vitee', role: 'admin', invitationPending: true });

		const mail = await waitForMail(email);
		expect(mail.subject).toContain('Kellerbühne');
		expect(mail.body.text).toContain('Olga Owner');
		const link = extractLink(mail.body.text);
		expect(link).toContain('/api/auth/reset-password/');

		// Setting the password accepts the invitation.
		expect(await setPasswordVia(link, 'my-own-password')).toBe(200);
		expect((await listMembers(tenant.id))[0].invitationPending).toBe(false);
	});

	it('adds existing users right away and notifies them', async () => {
		const tenant = await createTenant();
		const user = await createUser();
		const input = { tenant, email: user.email.toUpperCase(), name: 'ignored', role: 'boxoffice' as const, invitedBy: 'X' };

		expect(await inviteMember(input)).toBe('added');
		expect((await waitForMail(user.email)).subject).toContain(tenant.name);
		expect(await listMembers(tenant.id)).toMatchObject([{ userId: user.id, name: user.name, role: 'boxoffice', invitationPending: false }]);

		expect(await inviteMember(input)).toBe('already_member');
	});

	it('resends invitations only while they are pending', async () => {
		const tenant = await createTenant();
		const email = uniqueEmail('resend');
		await inviteMember({ tenant, email, name: 'R', role: 'admin', invitedBy: 'X' });
		const [member] = await listMembers(tenant.id);
		await waitForMail(email);

		expect(await resendInvitation({ tenant, userId: member.userId, invitedBy: 'X' })).toBe(true);
		await expect.poll(() => mailCount(email)).toBe(2);

		const active = await createUser();
		await addMembership(active.id, tenant.id, 'admin');
		expect(await resendInvitation({ tenant, userId: active.id, invitedBy: 'X' })).toBe(false);
	});
});

describe('owner protection', () => {
	it('never removes or demotes the last owner', async () => {
		const tenant = await createTenant();
		const owner = await createUser();
		const admin = await createUser();
		await addMembership(owner.id, tenant.id, 'owner');
		await addMembership(admin.id, tenant.id, 'admin');

		expect(await changeRole(tenant.id, owner.id, 'admin')).toBe('last_owner');
		expect(await removeMember(tenant.id, owner.id)).toBe('last_owner');

		// With a second owner it's fine.
		expect(await changeRole(tenant.id, admin.id, 'owner')).toBe('ok');
		expect(await changeRole(tenant.id, owner.id, 'admin')).toBe('ok');
		expect(await removeMember(tenant.id, owner.id)).toBe('ok');
		expect((await listMembers(tenant.id)).map((m) => m.userId)).toEqual([admin.id]);
	});

	it('keeps one owner even under concurrent demotions', async () => {
		const tenant = await createTenant();
		const a = await createUser();
		const b = await createUser();
		await addMembership(a.id, tenant.id, 'owner');
		await addMembership(b.id, tenant.id, 'owner');

		const results = await Promise.all([changeRole(tenant.id, a.id, 'admin'), changeRole(tenant.id, b.id, 'admin')]);
		expect(results.sort()).toEqual(['last_owner', 'ok']);
		expect((await listMembers(tenant.id)).filter((m) => m.role === 'owner')).toHaveLength(1);
	});

	it('reports unknown members', async () => {
		const tenant = await createTenant();
		expect(await removeMember(tenant.id, 'nope')).toBe('not_found');
	});
});
