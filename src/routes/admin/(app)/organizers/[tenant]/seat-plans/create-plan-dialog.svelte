<script lang="ts">
	import { enhance } from '$app/forms';
	import { ImageUp } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { m } from '#lib/paraglide/messages.js';

	let open = $state(false);
	let pending = $state(false);
	let error = $state<string | null>(null);

	const messages: Record<string, () => string> = {
		name: m.check_input,
		image: m.seat_plan_image_invalid,
		too_large: m.seat_plan_image_too_large
	};
</script>

<Dialog.Root bind:open onOpenChange={(o) => o && (error = null)}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props}><ImageUp /> {m.new_seat_plan()}</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.new_seat_plan()}</Dialog.Title>
			<Dialog.Description>{m.new_seat_plan_description()}</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			enctype="multipart/form-data"
			class="grid gap-4"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'failure') error = String(result.data?.error ?? 'image');
					else await update();
				};
			}}
		>
			<div class="grid gap-2">
				<Label for="plan-name">{m.event_name()}</Label>
				<Input id="plan-name" name="name" required maxlength={100} placeholder={m.seat_plan_name_placeholder()} />
			</div>
			<div class="grid gap-2">
				<Label for="plan-image">{m.seat_plan_image()}</Label>
				<Input id="plan-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
				<p class="text-xs text-muted-foreground">{m.seat_plan_image_hint()}</p>
			</div>
			{#if error}
				<Alert.Root variant="destructive"><Alert.Description>{(messages[error] ?? m.check_input)()}</Alert.Description></Alert.Root>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={pending}>{m.upload()}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
