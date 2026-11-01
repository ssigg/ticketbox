<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>Choose a new password</h1>
{#if form?.done}
	<p class="notice" role="status">Your password was changed.</p>
	<a href="/admin/login">Sign in</a>
{:else if !data.valid}
	<p class="error" role="alert">This reset link is invalid or has expired.</p>
	<a href="/admin/forgot-password">Request a new link</a>
{:else}
	<form method="POST" class="stack" use:enhance>
		<label>New password <input name="password" type="password" autocomplete="new-password" required minlength="8" /></label>
		<label>Repeat password <input name="confirm" type="password" autocomplete="new-password" required /></label>
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<button type="submit">Save password</button>
	</form>
{/if}
