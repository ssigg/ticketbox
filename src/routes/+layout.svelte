<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Ticketbox</title>
</svelte:head>

<!-- Follows the OS setting until the user picks a mode; sets .dark before first paint. -->
<ModeWatcher />
{@render children()}
