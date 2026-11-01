<script lang="ts">
	import { Check, Languages } from '@lucide/svelte';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, locales, setLocale, type Locale } from '#lib/paraglide/runtime.js';

	// Each language in its own name, so it's recognisable whatever is currently selected.
	const names: Record<Locale, string> = { en: 'English', de: 'Deutsch' };
	const current = getLocale();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={buttonVariants({ variant: 'ghost', size: 'sm' })}
		aria-label={m.language()}
		title={m.language()}
	>
		<Languages />
		<span class="uppercase">{current}</span>
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		{#each locales as locale (locale)}
			<!-- setLocale stores the choice in the PARAGLIDE_LOCALE cookie and reloads the page. -->
			<DropdownMenu.Item lang={locale} onSelect={() => setLocale(locale)}>
				{names[locale]}
				{#if locale === current}<Check class="ml-auto" />{/if}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
