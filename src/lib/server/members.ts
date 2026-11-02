import { randomBytes } from 'node:crypto';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { createPasswordSetupUrl, createUserWithPassword } from './auth';
import { db, type Db } from './db';
import { memberships, tenants, users, type Role, type Tenant } from './db/schema';
import { env } from './env';
import { sendInvitationMail, sendMembershipAddedMail } from './mail';
import type { Locale } from '../paraglide/runtime.js';

const INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function listMembers(tenantId: string) {
	return db
		.select({
			userId: users.id,
			name: users.name,
			email: users.email,
			role: memberships.role,
			// Invited users verify their address by setting a password.
			invitationPending: sql<boolean>`not ${users.emailVerified}`
		})
		.from(memberships)
		.innerJoin(users, eq(users.id, memberships.userId))
		.where(eq(memberships.tenantId, tenantId))
		.orderBy(asc(users.name));
}

export type InviteResult = 'invited' | 'added' | 'already_member';

/**
 * Adds a member. Unknown emails get an account and an invitation to set their password;
 * existing users are added right away and notified.
 */
export async function inviteMember(input: {
	tenant: Pick<Tenant, 'id' | 'name' | 'defaultLocale'>;
	email: string;
	name: string;
	role: Role;
	invitedBy: string;
}): Promise<InviteResult> {
	const email = input.email.trim().toLowerCase();
	const locale = input.tenant.defaultLocale as Locale;
	const [existing] = await db.select().from(users).where(eq(users.email, email));

	if (existing) {
		const [added] = await db
			.insert(memberships)
			.values({ userId: existing.id, tenantId: input.tenant.id, role: input.role })
			.onConflictDoNothing()
			.returning();
		if (!added) return 'already_member';
		await sendMembershipAddedMail(email, {
			organizer: input.tenant.name,
			invitedBy: input.invitedBy,
			link: `${env.origin}/admin/organizers`,
			locale
		});
		return 'added';
	}

	const user = await createUserWithPassword({
		email,
		name: input.name.trim(),
		// Unusable until the invitee picks their own via the emailed link.
		password: randomBytes(32).toString('base64url'),
		emailVerified: false
	});
	await db.insert(memberships).values({ userId: user.id, tenantId: input.tenant.id, role: input.role });
	await sendInvitationMail(email, {
		organizer: input.tenant.name,
		invitedBy: input.invitedBy,
		link: await createPasswordSetupUrl(user.id, INVITATION_TTL_SECONDS),
		locale
	});
	return 'invited';
}

/** Sends a fresh invitation link to a member who has not set a password yet. */
export async function resendInvitation(input: {
	tenant: Pick<Tenant, 'id' | 'name' | 'defaultLocale'>;
	userId: string;
	invitedBy: string;
}): Promise<boolean> {
	const [member] = (await listMembers(input.tenant.id)).filter((m) => m.userId === input.userId);
	if (!member?.invitationPending) return false;
	await sendInvitationMail(member.email, {
		organizer: input.tenant.name,
		invitedBy: input.invitedBy,
		link: await createPasswordSetupUrl(member.userId, INVITATION_TTL_SECONDS),
		locale: input.tenant.defaultLocale as Locale
	});
	return true;
}

export type MembershipChangeResult = 'ok' | 'not_found' | 'last_owner';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Locks the organizer row so concurrent role changes are serialized; without it two owners
 * could demote each other at the same time and leave the organizer without an owner.
 */
async function lockTenant(tx: Tx, tenantId: string) {
	await tx.execute(sql`select 1 from ${tenants} where ${tenants.id} = ${tenantId} for update`);
}

/** Every organizer that has an owner keeps at least one. */
async function wouldRemoveLastOwner(tx: Tx, tenantId: string, userId: string): Promise<boolean> {
	const [current] = await tx
		.select({ role: memberships.role })
		.from(memberships)
		.where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
	if (current?.role !== 'owner') return false;
	const [{ owners }] = await tx
		.select({ owners: count() })
		.from(memberships)
		.where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, 'owner')));
	return owners <= 1;
}

export async function changeRole(tenantId: string, userId: string, role: Role): Promise<MembershipChangeResult> {
	return db.transaction(async (tx) => {
		await lockTenant(tx, tenantId);
		if (role !== 'owner' && (await wouldRemoveLastOwner(tx, tenantId, userId))) return 'last_owner';
		const updated = await tx
			.update(memberships)
			.set({ role })
			.where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
			.returning();
		return updated.length ? 'ok' : 'not_found';
	});
}

export async function removeMember(tenantId: string, userId: string): Promise<MembershipChangeResult> {
	return db.transaction(async (tx) => {
		await lockTenant(tx, tenantId);
		if (await wouldRemoveLastOwner(tx, tenantId, userId)) return 'last_owner';
		const removed = await tx
			.delete(memberships)
			.where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
			.returning();
		return removed.length ? 'ok' : 'not_found';
	});
}

