<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1 class="mb-4 text-2xl font-semibold tracking-tight">{data.tenant.name}</h1>
<Card.Root>
	<Card.Content class="text-muted-foreground">{m.tenant_placeholder()}</Card.Content>
</Card.Root>
