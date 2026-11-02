<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { cn } from '#lib/utils.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/admin/organizers/${data.tenant.slug}`);
	const tabs = $derived([
		{ href: base, label: m.overview(), show: true },
		{ href: `${base}/members`, label: m.members(), show: data.tenant.role === 'owner' }
	]);
</script>

<h1 class="mb-4 text-2xl font-semibold tracking-tight">{data.tenant.name}</h1>
<nav class="mb-6 flex gap-1 border-b" aria-label={data.tenant.name}>
	{#each tabs.filter((t) => t.show) as tab (tab.href)}
		{@const active = page.url.pathname === tab.href}
		<a
			href={tab.href}
			aria-current={active ? 'page' : undefined}
			class={cn(
				'-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
				active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
			)}
		>
			{tab.label}
		</a>
	{/each}
</nav>
{@render children()}
