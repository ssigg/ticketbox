<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import EventForm from '../event-form.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<EventForm
	values={(form && 'values' in form && form.values) || data.values}
	errors={form && 'errors' in form ? form.errors : undefined}
	defaultLocale={data.tenant.defaultLocale}
	timezone={data.tenant.timezone}
	autoSlug={false}
	submitLabel={m.save()}
	saved={(form && 'saved' in form) || page.url.searchParams.has('created')}
/>
