// Creates a demo tenant and an admin user. Safe to run repeatedly.
import { client, db } from '../src/lib/server/db';
import { memberships, tenants, users } from '../src/lib/server/db/schema';
import { hashPassword } from '../src/lib/server/auth';

const email = process.env.SEED_EMAIL ?? 'admin@example.com';
const password = process.env.SEED_PASSWORD ?? 'admin1234';

const [tenant] = await db
	.insert(tenants)
	.values({ slug: 'demo', name: 'Demo Theater' })
	.onConflictDoUpdate({ target: tenants.slug, set: { name: 'Demo Theater' } })
	.returning();
const [user] = await db
	.insert(users)
	.values({ email, name: 'Admin', passwordHash: await hashPassword(password), isSuperadmin: true })
	.onConflictDoUpdate({ target: users.email, set: { passwordHash: await hashPassword(password) } })
	.returning();
await db
	.insert(memberships)
	.values({ userId: user.id, tenantId: tenant.id, role: 'owner' })
	.onConflictDoNothing();

await client.end();
console.log(`Seeded tenant "demo" and user ${email}`);
