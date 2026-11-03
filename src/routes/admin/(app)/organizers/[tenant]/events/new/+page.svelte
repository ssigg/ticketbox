<script lang="ts">
	import { ChevronLeft } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import EventForm from '../event-form.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<a href="/admin/organizers/{data.tenant.slug}/events" class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
	<ChevronLeft class="size-4" /> {m.events()}
</a>
<h2 class="mb-4 text-lg font-semibold">{m.new_event()}</h2>
<EventForm
	values={form?.values ?? {}}
	errors={form?.errors}
	defaultLocale={data.tenant.defaultLocale}
	timezone={data.tenant.timezone}
	autoSlug
	submitLabel={m.create()}
/>
