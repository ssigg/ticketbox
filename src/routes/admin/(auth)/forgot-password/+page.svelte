<script lang="ts">
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
		if (result.error) error = authErrorMessage(result.error, 'Something went wrong. Please try again.');
		else sent = true;
	}
</script>

<Card.Header>
	<Card.Title><h1 class="text-xl">Reset password</h1></Card.Title>
	<Card.Description>We'll email you a link to choose a new password.</Card.Description>
</Card.Header>
<Card.Content class="grid gap-4">
	{#if sent}
		<Alert.Root role="status">
			<Alert.Description>If an account exists for this email, we sent a reset link.</Alert.Description>
		</Alert.Root>
	{:else}
		<form class="grid gap-4" onsubmit={submit}>
			<div class="grid gap-2">
				<Label for="email">Email</Label>
				<Input id="email" bind:value={email} type="email" required />
			</div>
			{#if error}
				<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>
			{/if}
			<Button type="submit" class="w-full" disabled={!ready || pending}>Send reset link</Button>
		</form>
	{/if}
	<Button href="/admin/login" variant="link" class="justify-self-center">Back to sign in</Button>
</Card.Content>
