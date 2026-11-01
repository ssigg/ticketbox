// See https://svelte.dev/docs/kit/types#app.d.ts
import type { auth } from '#lib/server/auth.ts';

type AuthSession = typeof auth.$Infer.Session;

declare global {
	namespace App {
		interface Locals {
			user: AuthSession['user'] | null;
			session: AuthSession['session'] | null;
		}
	}
}

export {};
