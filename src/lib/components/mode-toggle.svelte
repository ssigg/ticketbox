<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { mode, toggleMode } from 'mode-watcher';
	import { Button } from '#lib/components/ui/button/index.js';
	import { m } from '#lib/paraglide/messages.js';

	const label = $derived(mode.current === 'dark' ? m.switch_to_light() : m.switch_to_dark());
</script>

<Button variant="ghost" size="icon-sm" onclick={toggleMode} aria-label={label} title={label}>
	<Sun class="dark:hidden" />
	<Moon class="hidden dark:block" />
</Button>
