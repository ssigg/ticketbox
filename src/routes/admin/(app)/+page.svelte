<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1 class="mb-4 text-2xl font-semibold tracking-tight">Organizers</h1>
{#if data.tenants.length === 0}
	<p class="text-muted-foreground">You don't have access to any organizer yet.</p>
{:else}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.tenants as tenant (tenant.id)}
			<li>
				<a href="/admin/{tenant.slug}" class="group block">
					<Card.Root class="transition-colors group-hover:bg-accent">
						<Card.Header>
							<Card.Title>{tenant.name}</Card.Title>
							<Card.Description class="capitalize">{tenant.role}</Card.Description>
							<Card.Action><ChevronRight class="size-4 text-muted-foreground" /></Card.Action>
						</Card.Header>
					</Card.Root>
				</a>
			</li>
		{/each}
	</ul>
{/if}
