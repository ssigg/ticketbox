<script lang="ts">
	import { page } from '$app/state';
	import { ChevronLeft } from '@lucide/svelte';
	import { localized } from '#lib/localized.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { cn } from '#lib/utils.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const events = $derived(`/admin/organizers/${data.tenant.slug}/events`);
	const base = $derived(`${events}/${data.event.id}`);
	const title = $derived(localized(data.event.name, getLocale(), data.tenant.defaultLocale));
	const tabs = $derived([
		{ href: base, label: m.event_details() },
		{ href: `${base}/categories`, label: m.categories() },
		{ href: `${base}/reductions`, label: m.reductions() },
		{ href: `${base}/seating`, label: m.seat_plan() }
	]);
</script>

<a href={events} class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
	<ChevronLeft class="size-4" /> {m.events()}
</a>
<h2 class="mb-3 text-lg font-semibold">{title}</h2>
<nav class="mb-6 flex gap-1" aria-label={title}>
	{#each tabs as tab (tab.href)}
		{@const active = page.url.pathname === tab.href}
		<a
			href={tab.href}
			aria-current={active ? 'page' : undefined}
			class={cn(
				'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
				active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'
			)}
		>
			{tab.label}
		</a>
	{/each}
</nav>
{@render children()}
