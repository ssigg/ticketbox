import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '../../src/lib/server/db';
import { memberships, tenants, type Role } from '../../src/lib/server/db/schema';
import { createUserWithPassword } from '../../src/lib/server/auth';

/** Drops everything in the test database and re-applies all migrations. */
export async function resetDatabase() {
	if (!process.env.DATABASE_URL?.includes('_test')) {
		throw new Error('Refusing to reset a database whose name does not contain "_test"');
	}
	await db.execute(sql`drop schema if exists public cascade`);
	await db.execute(sql`drop schema if exists drizzle cascade`);
	await db.execute(sql`create schema public`);
	await migrate(db, { migrationsFolder: 'drizzle' });
}

export function uniqueEmail(prefix = 'user') {
	return `${prefix}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

export async function createUser(
	opts: { email?: string; password?: string; name?: string; isSuperadmin?: boolean } = {}
) {
	const password = opts.password ?? 'correct-horse';
	const user = await createUserWithPassword({
		email: opts.email ?? uniqueEmail(),
		name: opts.name ?? 'Test User',
		password,
		isSuperadmin: opts.isSuperadmin
	});
	return { ...user, password };
}

export async function createTenant(name = 'Test Theater') {
	const [tenant] = await db
		.insert(tenants)
		.values({ name, slug: `t-${crypto.randomUUID().slice(0, 8)}` })
		.returning();
	return tenant;
}

export async function addMembership(userId: string, tenantId: string, role: Role = 'admin') {
	await db.insert(memberships).values({ userId, tenantId, role });
}
