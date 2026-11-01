<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>Organizers</h1>
{#if data.tenants.length === 0}
	<p class="muted">You don't have access to any organizer yet.</p>
{:else}
	<ul class="tenants">
		{#each data.tenants as tenant (tenant.id)}
			<li class="card">
				<a href="/admin/{tenant.slug}">{tenant.name}</a>
				<span class="muted">{tenant.role}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.tenants { list-style: none; padding: 0; display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
	.tenants li { display: flex; justify-content: space-between; align-items: center; }
</style>
