<script lang="ts">
	import { enhance } from '$app/forms';
	import { UserPlus } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { ROLES, roleDescription, roleLabel, type Role } from './role-labels';

	let open = $state(false);
	let pending = $state(false);
	let email = $state('');
	let name = $state('');
	let role = $state<Role>('admin');
	let invalid = $state<string[]>([]);
	let alreadyMember = $state<string | null>(null);

	function reset() {
		email = name = '';
		role = 'admin';
		invalid = [];
		alreadyMember = null;
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => o && reset()}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props}><UserPlus /> {m.invite_member()}</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.invite_member()}</Dialog.Title>
			<Dialog.Description>{m.invite_member_description()}</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/invite"
			class="grid gap-4"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'failure') {
						invalid = (result.data?.invalid as string[]) ?? [];
						alreadyMember = (result.data?.alreadyMember as string) ?? null;
					} else {
						open = false;
						await update();
					}
				};
			}}
		>
			<div class="grid gap-2">
				<Label for="invite-email">{m.email()}</Label>
				<Input id="invite-email" name="email" type="email" bind:value={email} aria-invalid={invalid.includes('email')} required />
			</div>
			<div class="grid gap-2">
				<Label for="invite-name">{m.name()}</Label>
				<Input id="invite-name" name="name" bind:value={name} aria-invalid={invalid.includes('name')} required maxlength={100} />
			</div>
			<div class="grid gap-2">
				<Label for="invite-role">{m.role()}</Label>
				<Select.Root type="single" name="role" bind:value={role}>
					<Select.Trigger id="invite-role" class="w-full">{roleLabel[role]()}</Select.Trigger>
					<Select.Content>
						{#each ROLES as r (r)}
							<Select.Item value={r} label={roleLabel[r]()}>
								<div class="grid">
									<span>{roleLabel[r]()}</span>
									<span class="text-xs text-muted-foreground">{roleDescription[r]()}</span>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			{#if alreadyMember}
				<Alert.Root variant="destructive"><Alert.Description>{m.already_member({ email: alreadyMember })}</Alert.Description></Alert.Root>
			{:else if invalid.length}
				<Alert.Root variant="destructive"><Alert.Description>{m.check_input()}</Alert.Description></Alert.Root>
			{/if}
			<Dialog.Footer>
				<Button type="submit" disabled={pending}>{m.invite()}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
