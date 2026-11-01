<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { authClient, authErrorMessage } from '#lib/auth-client.ts';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { onMount } from 'svelte';

	let email = $state('');
	let sent = $state(false);
	let error = $state('');
	let pending = $state(false);
	let ready = $state(false);
	onMount(() => (ready = true));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		pending = true;
		const result = await authClient.requestPasswordReset({
			email,
			redirectTo: `${location.origin}/admin/reset-password`
		});
		pending = false;
		// Better Auth answers the same way whether or not the account exists.
		if (result.error) error = authErrorMessage(result.error, m.generic_error());
		else sent = true;
	}
</script>

<Card.Header>
	<Card.Title><h1 class="text-xl">{m.reset_title()}</h1></Card.Title>
	<Card.Description>{m.reset_description()}</Card.Description>
</Card.Header>
<Card.Content class="grid gap-4">
	{#if sent}
		<Alert.Root role="status">
			<Alert.Description>{m.reset_sent()}</Alert.Description>
		</Alert.Root>
	{:else}
		<form class="grid gap-4" onsubmit={submit}>
			<div class="grid gap-2">
				<Label for="email">{m.email()}</Label>
				<Input id="email" bind:value={email} type="email" required />
			</div>
			{#if error}
				<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>
			{/if}
			<Button type="submit" class="w-full" disabled={!ready || pending}>{m.reset_send()}</Button>
		</form>
	{/if}
	<Button href="/admin/login" variant="link" class="justify-self-center">{m.back_to_sign_in()}</Button>
</Card.Content>
