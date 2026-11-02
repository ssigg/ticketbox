// Creates a superadmin, or promotes an existing user to superadmin.
//   npm run user:superadmin -- <email> [name]
// The password comes from SUPERADMIN_PASSWORD; otherwise a random one is printed once.
import { eq } from 'drizzle-orm';
import { client, db } from '../src/lib/server/db';
import { users } from '../src/lib/server/db/schema';
import { createUserWithPassword } from '../src/lib/server/auth';

const [email, name = 'Superadmin'] = process.argv.slice(2);
if (!email?.includes('@')) {
	console.error('Usage: npm run user:superadmin -- <email> [name]');
	process.exit(1);
}

const normalized = email.trim().toLowerCase();
const [existing] = await db.select().from(users).where(eq(users.email, normalized));
if (existing) {
	await db.update(users).set({ isSuperadmin: true }).where(eq(users.id, existing.id));
	console.log(`${normalized} is now a superadmin (password unchanged).`);
} else {
	const password =
		process.env.SUPERADMIN_PASSWORD ?? Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('base64url');
	await createUserWithPassword({ email: normalized, name, password, isSuperadmin: true });
	console.log(`Created superadmin ${normalized}.`);
	if (!process.env.SUPERADMIN_PASSWORD) console.log(`Initial password: ${password}  (change it on the profile page)`);
}
await client.end();
