<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { ChevronRight } from '@lucide/svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import CreateOrganizerDialog from './create-organizer-dialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const roleLabels = { owner: m.role_owner, admin: m.role_admin, boxoffice: m.role_boxoffice };
</script>

<div class="mb-4 flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">{m.organizers()}</h1>
	{#if data.user.isSuperadmin}<CreateOrganizerDialog />{/if}
</div>
{#if data.tenants.length === 0}
	<p class="text-muted-foreground">{m.no_organizers()}</p>
{:else}
	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.tenants as tenant (tenant.id)}
			<li>
				<a href="/admin/organizers/{tenant.slug}" class="group block">
					<Card.Root class="transition-colors group-hover:bg-accent">
						<Card.Header>
							<Card.Title>{tenant.name}</Card.Title>
							<Card.Description>{roleLabels[tenant.role]()}</Card.Description>
							<Card.Action><ChevronRight class="size-4 text-muted-foreground" /></Card.Action>
						</Card.Header>
					</Card.Root>
				</a>
			</li>
		{/each}
	</ul>
{/if}
