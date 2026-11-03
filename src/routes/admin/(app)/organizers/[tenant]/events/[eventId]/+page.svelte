<script lang="ts">
	import { page } from '$app/state';
	import { ChevronLeft } from '@lucide/svelte';
	import { localized } from '#lib/localized.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import EventForm from '../event-form.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const title = $derived(localized(data.event.name, getLocale(), data.tenant.defaultLocale));
</script>

<a href="/admin/organizers/{data.tenant.slug}/events" class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
	<ChevronLeft class="size-4" /> {m.events()}
</a>
<h2 class="mb-4 text-lg font-semibold">{title}</h2>
<EventForm
	values={(form && 'values' in form && form.values) || data.values}
	errors={form && 'errors' in form ? form.errors : undefined}
	defaultLocale={data.tenant.defaultLocale}
	timezone={data.tenant.timezone}
	autoSlug={false}
	submitLabel={m.save()}
	saved={(form && 'saved' in form) || page.url.searchParams.has('created')}
/>
