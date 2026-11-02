<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';
</script>

<Card.Root>
	<Card.Content class="text-muted-foreground">{m.tenant_placeholder()}</Card.Content>
</Card.Root>
