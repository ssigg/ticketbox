// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '#lib/server/auth.ts';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
		}
	}
}

export {};
