import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient();

/** Maps a Better Auth client error to a message for the user. */
export function authErrorMessage(error: { status: number }, fallback: string) {
	if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
	return fallback;
}
