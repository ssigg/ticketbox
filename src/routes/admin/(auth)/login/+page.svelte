<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient, authErrorMessage } from '#lib/auth-client.ts';
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

<h1>Sign in</h1>
<form class="stack" onsubmit={submit}>
	<label>Email <input bind:value={email} type="email" autocomplete="username" required /></label>
	<label>Password <input bind:value={password} type="password" autocomplete="current-password" required /></label>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<button type="submit" disabled={!ready || pending}>Sign in</button>
	<a href="/admin/forgot-password">Forgot password?</a>
</form>
