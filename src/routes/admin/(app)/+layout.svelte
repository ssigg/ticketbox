<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const current = $derived(data.tenants.find((t) => t.slug === page.params.tenant));
</script>

<header>
	<a class="brand" href="/admin">Ticketbox</a>
	{#if current}<span class="tenant">/ {current.name}</span>{/if}
	<span class="spacer"></span>
	<span class="muted" data-testid="current-user">{data.user.name}</span>
	<form method="POST" action="/admin/logout">
		<button class="link" type="submit">Sign out</button>
	</form>
</header>

<main>{@render children()}</main>

<style>
	header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
	.brand { font-weight: 700; color: inherit; text-decoration: none; }
	.spacer { flex: 1; }
	main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 16px; }
</style>
