<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient, authErrorMessage } from '#lib/auth-client.ts';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { onMount } from 'svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let pending = $state(false);
	// The form only works once hydrated; a native submit would leak the password into the URL.
	let ready = $state(false);
	onMount(() => (ready = true));

	function redirectTarget() {
		const target = page.url.searchParams.get('redirectTo');
		return target?.startsWith('/admin') && !target.startsWith('//') ? target : '/admin';
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		pending = true;
		const result = await authClient.signIn.email({ email, password });
		pending = false;
		if (result.error) {
			error = authErrorMessage(result.error, 'Invalid email or password.');
			return;
		}
		await invalidateAll();
		await goto(redirectTarget());
	}
</script>

<Card.Header>
	<Card.Title><h1 class="text-xl">Sign in</h1></Card.Title>
	<Card.Description>Administration for organizers</Card.Description>
</Card.Header>
<Card.Content>
	<form class="grid gap-4" onsubmit={submit}>
		<div class="grid gap-2">
			<Label for="email">Email</Label>
			<Input id="email" bind:value={email} type="email" autocomplete="username" required />
		</div>
		<div class="grid gap-2">
			<div class="flex items-center justify-between">
				<Label for="password">Password</Label>
				<a href="/admin/forgot-password" class="text-sm text-muted-foreground underline-offset-4 hover:underline">
					Forgot password?
				</a>
			</div>
			<Input id="password" bind:value={password} type="password" autocomplete="current-password" required />
		</div>
		{#if error}
			<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>
		{/if}
		<Button type="submit" class="w-full" disabled={!ready || pending}>Sign in</Button>
	</form>
</Card.Content>
