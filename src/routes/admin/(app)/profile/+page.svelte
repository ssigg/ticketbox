<script lang="ts">
	import { authClient, authErrorMessage } from '#lib/auth-client.ts';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirm = $state('');
	let error = $state('');
	let success = $state(false);
	let pending = $state(false);
	let ready = $state(false);
	onMount(() => (ready = true));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		success = false;
		if (newPassword !== confirm) {
			error = m.passwords_mismatch();
			return;
		}
		pending = true;
		// Signs out every other session, so a leaked password stops working everywhere else.
		const result = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: true
		});
		pending = false;
		if (result.error) {
			const code = result.error.code;
			error = authErrorMessage(
				result.error,
				code === 'INVALID_PASSWORD'
					? m.wrong_current_password()
					: code === 'PASSWORD_TOO_SHORT'
						? m.password_too_short()
						: m.generic_error()
			);
			return;
		}
		currentPassword = newPassword = confirm = '';
		success = true;
	}
</script>

<h1 class="mb-4 text-2xl font-semibold tracking-tight">{m.profile()}</h1>

<div class="grid max-w-xl gap-6">
	<Card.Root>
		<Card.Header>
			<Card.Title><h2>{m.account()}</h2></Card.Title>
			{#if data.user.isSuperadmin}
				<Card.Action><Badge variant="secondary">{m.superadmin()}</Badge></Card.Action>
			{/if}
		</Card.Header>
		<Card.Content>
			<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
				<dt class="text-muted-foreground">{m.name()}</dt>
				<dd>{data.user.name}</dd>
				<dt class="text-muted-foreground">{m.email()}</dt>
				<dd>{data.user.email}</dd>
			</dl>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title><h2>{m.change_password()}</h2></Card.Title>
			<Card.Description>{m.change_password_hint()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form class="grid gap-4" onsubmit={submit}>
				<!-- Lets password managers associate the new password with this account. -->
				<input type="email" name="username" autocomplete="username" value={data.user.email} hidden readonly />
				<div class="grid gap-2">
					<Label for="current-password">{m.current_password()}</Label>
					<Input id="current-password" bind:value={currentPassword} type="password" autocomplete="current-password" required />
				</div>
				<div class="grid gap-2">
					<Label for="new-password">{m.new_password()}</Label>
					<Input id="new-password" bind:value={newPassword} type="password" autocomplete="new-password" required minlength={8} />
				</div>
				<div class="grid gap-2">
					<Label for="confirm-password">{m.repeat_password()}</Label>
					<Input id="confirm-password" bind:value={confirm} type="password" autocomplete="new-password" required />
				</div>
				{#if error}
					<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>
				{/if}
				{#if success}
					<Alert.Root role="status"><Alert.Description>{m.password_changed()}</Alert.Description></Alert.Root>
				{/if}
				<Button type="submit" class="justify-self-start" disabled={!ready || pending}>{m.save_password()}</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
