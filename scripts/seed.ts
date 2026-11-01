// Creates a demo tenant and an admin user. Safe to run repeatedly.
import { eq } from 'drizzle-orm';
import { client, db } from '../src/lib/server/db';
import { memberships, tenants, users } from '../src/lib/server/db/schema';
import { createUserWithPassword } from '../src/lib/server/auth';

const email = process.env.SEED_EMAIL ?? 'admin@example.com';
const password = process.env.SEED_PASSWORD ?? 'admin1234';

const [tenant] = await db
	.insert(tenants)
	.values({ slug: 'demo', name: 'Demo Theater' })
	.onConflictDoUpdate({ target: tenants.slug, set: { name: 'Demo Theater' } })
	.returning();

const [existing] = await db.select().from(users).where(eq(users.email, email));
const user =
	existing ?? (await createUserWithPassword({ email, name: 'Admin', password, isSuperadmin: true }));
await db
	.insert(memberships)
	.values({ userId: user.id, tenantId: tenant.id, role: 'owner' })
	.onConflictDoNothing();

await client.end();
console.log(existing ? `User ${email} already exists` : `Seeded tenant "demo" and user ${email}`);
