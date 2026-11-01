<script lang="ts">
	import { Ticket } from '@lucide/svelte';
	import ModeToggle from '#lib/components/mode-toggle.svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	let { children } = $props();
</script>

<div class="fixed top-3 right-3"><ModeToggle /></div>

<main class="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4">
	<p class="flex items-center justify-center gap-2 text-lg font-semibold">
		<Ticket class="size-5" /> Ticketbox
	</p>
	<Card.Root>{@render children()}</Card.Root>
</main>
