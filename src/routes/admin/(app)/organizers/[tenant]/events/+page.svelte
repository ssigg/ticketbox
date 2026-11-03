<script lang="ts">
	import { CalendarPlus } from '@lucide/svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { localized } from '#lib/localized.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatDateTime } from '#lib/zoned-time.ts';
	import { statusLabel, statusVariant } from './status';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const base = $derived(`/admin/organizers/${data.tenant.slug}/events`);
	const now = new Date();
</script>

<div class="mb-4 flex items-center justify-between gap-4">
	<h2 class="text-lg font-semibold">{m.events()}</h2>
	<Button href="{base}/new"><CalendarPlus /> {m.new_event()}</Button>
</div>

{#if data.events.length === 0}
	<Card.Root>
		<Card.Content class="text-muted-foreground">{m.no_events()}</Card.Content>
	</Card.Root>
{:else}
	<Card.Root class="py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m.event_name()}</Table.Head>
					<Table.Head>{m.starts_at()}</Table.Head>
					<Table.Head class="hidden md:table-cell">{m.venue()}</Table.Head>
					<Table.Head>{m.status()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.events as event (event.id)}
					<Table.Row class={event.startsAt < now ? 'text-muted-foreground' : ''}>
						<Table.Cell class="font-medium">
							<a href="{base}/{event.id}" class="hover:underline">
								{localized(event.name, getLocale(), data.tenant.defaultLocale)}
							</a>
						</Table.Cell>
						<Table.Cell>{formatDateTime(event.startsAt, data.tenant.timezone, getLocale())}</Table.Cell>
						<Table.Cell class="hidden md:table-cell">{event.venue}</Table.Cell>
						<Table.Cell><Badge variant={statusVariant[event.status]}>{statusLabel[event.status]()}</Badge></Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
{/if}
