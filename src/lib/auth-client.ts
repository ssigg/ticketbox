import { createAuthClient } from 'better-auth/svelte';
import { m } from '#lib/paraglide/messages.js';

export const authClient = createAuthClient();

/** Maps a Better Auth client error to a message for the user. */
export function authErrorMessage(error: { status: number }, fallback: string) {
	if (error.status === 429) return m.too_many_attempts();
	return fallback;
}
