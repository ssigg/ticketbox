<script lang="ts">
	import { authClient, authErrorMessage } from '#lib/auth-client.ts';
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

<h1>Reset password</h1>
{#if sent}
	<p class="notice" role="status">If an account exists for this email, we sent a reset link.</p>
	<a href="/admin/login">Back to sign in</a>
{:else}
	<form class="stack" onsubmit={submit}>
		<label>Email <input bind:value={email} type="email" required /></label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button type="submit" disabled={!ready || pending}>Send reset link</button>
		<a href="/admin/login">Back to sign in</a>
	</form>
{/if}
