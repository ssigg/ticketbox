<script lang="ts">
	import { page } from '$app/state';
	import { authClient, authErrorMessage } from '#lib/auth-client.ts';
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
			error = 'Passwords do not match.';
			return;
		}
		pending = true;
		const result = await authClient.resetPassword({ newPassword: password, token: token! });
		pending = false;
		if (result.error) {
			error = authErrorMessage(
				result.error,
				result.error.code === 'PASSWORD_TOO_SHORT'
					? 'Password must be at least 8 characters.'
					: 'This reset link is invalid or has expired.'
			);
		} else done = true;
	}
</script>

<h1>Choose a new password</h1>
{#if done}
	<p class="notice" role="status">Your password was changed.</p>
	<a href="/admin/login">Sign in</a>
{:else if linkInvalid}
	<p class="error" role="alert">This reset link is invalid or has expired.</p>
	<a href="/admin/forgot-password">Request a new link</a>
{:else}
	<form class="stack" onsubmit={submit}>
		<label>New password <input bind:value={password} type="password" autocomplete="new-password" required minlength="8" /></label>
		<label>Repeat password <input bind:value={confirm} type="password" autocomplete="new-password" required /></label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button type="submit" disabled={!ready || pending}>Save password</button>
	</form>
{/if}
