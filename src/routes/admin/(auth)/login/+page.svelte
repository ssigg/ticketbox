<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<h1>Sign in</h1>
<form method="POST" class="stack" use:enhance>
	<label>Email <input name="email" type="email" autocomplete="username" required value={form?.email ?? ''} /></label>
	<label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<button type="submit">Sign in</button>
	<a href="/admin/forgot-password">Forgot password?</a>
</form>
