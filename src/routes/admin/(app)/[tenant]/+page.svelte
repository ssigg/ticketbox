<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1>{data.tenant.name}</h1>
<div class="card">
	<p class="muted">Events, seat plans and orders will appear here.</p>
</div>
