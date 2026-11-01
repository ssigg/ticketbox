<script lang="ts">
	let { children } = $props();
</script>

<main>
	<p class="brand">Ticketbox</p>
	<div class="card">{@render children()}</div>
</main>

<style>
	main { max-width: 380px; margin: 10vh auto; padding: 0 16px; }
	.brand { font-weight: 700; font-size: 1.25rem; text-align: center; }
</style>
