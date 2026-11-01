<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { page } from '$app/state';
	import { authClient, authErrorMessage } from '#lib/auth-client.ts';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { onMount } from 'svelte';

	// Better Auth validates the emailed link and redirects here with ?token=… or ?error=INVALID_TOKEN.
	const token = $derived(page.url.searchParams.get('token'));
	const linkInvalid = $derived(!token || page.url.searchParams.has('error'));

	let password = $state('');
	let confirm = $state('');
	let error = $state('');
	let done = $state(false);
	let pending = $state(false);
	let ready = $state(false);
	onMount(() => (ready = true));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (password !== confirm) {
			error = m.passwords_mismatch();
			return;
		}
		pending = true;
		const result = await authClient.resetPassword({ newPassword: password, token: token! });
		pending = false;
		if (result.error) {
			error = authErrorMessage(
				result.error,
				result.error.code === 'PASSWORD_TOO_SHORT'
					? m.password_too_short()
					: m.reset_link_invalid()
			);
		} else done = true;
	}
</script>

<Card.Header>
	<Card.Title><h1 class="text-xl">{m.new_password_title()}</h1></Card.Title>
</Card.Header>
<Card.Content class="grid gap-4">
	{#if done}
		<Alert.Root role="status"><Alert.Description>{m.password_changed()}</Alert.Description></Alert.Root>
		<Button href="/admin/login" class="w-full">{m.sign_in()}</Button>
	{:else if linkInvalid}
		<Alert.Root variant="destructive">
			<Alert.Description>{m.reset_link_invalid()}</Alert.Description>
		</Alert.Root>
		<Button href="/admin/forgot-password" variant="link" class="justify-self-center">{m.request_new_link()}</Button>
	{:else}
		<form class="grid gap-4" onsubmit={submit}>
			<div class="grid gap-2">
				<Label for="password">{m.new_password()}</Label>
				<Input id="password" bind:value={password} type="password" autocomplete="new-password" required minlength={8} />
			</div>
			<div class="grid gap-2">
				<Label for="confirm">{m.repeat_password()}</Label>
				<Input id="confirm" bind:value={confirm} type="password" autocomplete="new-password" required />
			</div>
			{#if error}
				<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>
			{/if}
			<Button type="submit" class="w-full" disabled={!ready || pending}>{m.save_password()}</Button>
		</form>
	{/if}
</Card.Content>
