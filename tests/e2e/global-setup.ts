import { client } from '../../src/lib/server/db';
import { resetDatabase } from '../helpers/db';

export default async function globalSetup() {
	await resetDatabase();
	await client.end();
}
