<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<h1>Reset password</h1>
{#if form?.sent}
	<p class="notice" role="status">If an account exists for this email, we sent a reset link.</p>
	<a href="/admin/login">Back to sign in</a>
{:else}
	<form method="POST" class="stack" use:enhance>
		<label>Email <input name="email" type="email" required /></label>
		<button type="submit">Send reset link</button>
		<a href="/admin/login">Back to sign in</a>
	</form>
{/if}
