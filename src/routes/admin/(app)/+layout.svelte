<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { LogOut, Ticket } from '@lucide/svelte';
	import { authClient } from '#lib/auth-client.ts';
	import ModeToggle from '#lib/components/mode-toggle.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const current = $derived(data.tenants.find((t) => t.slug === page.params.tenant));

	async function signOut() {
		await authClient.signOut();
		await goto('/admin/login', { invalidateAll: true });
	}
</script>

<div class="min-h-svh bg-muted/40">
	<header class="border-b bg-background">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
			<a href="/admin" class="flex items-center gap-2 font-semibold"><Ticket class="size-5" /> Ticketbox</a>
			{#if current}<span class="text-muted-foreground">/ {current.name}</span>{/if}
			<span class="flex-1"></span>
			<span class="hidden text-sm text-muted-foreground sm:inline" data-testid="current-user">{data.user.name}</span>
			<ModeToggle />
			<Button variant="ghost" size="sm" onclick={signOut}><LogOut /> Sign out</Button>
		</div>
	</header>
	<main class="mx-auto max-w-6xl px-4 py-6">{@render children()}</main>
</div>
