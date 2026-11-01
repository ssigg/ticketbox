export async function setup() {
	const { resetDatabase } = await import('../helpers/db');
	const { client } = await import('../../src/lib/server/db');
	await resetDatabase();
	await client.end();
}
