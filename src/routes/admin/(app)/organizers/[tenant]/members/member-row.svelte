<script lang="ts">
	import { enhance } from '$app/forms';
	import { Mail, Trash2 } from '@lucide/svelte';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { tick } from 'svelte';
	import { ROLES, roleLabel, type Role } from './role-labels';

	interface Props {
		member: { userId: string; name: string; email: string; role: Role; invitationPending: boolean };
		organizer: string;
		isSelf: boolean;
		/** The only owner can neither be demoted nor removed (the server refuses it too). */
		isLastOwner: boolean;
	}
	let { member, organizer, isSelf, isLastOwner }: Props = $props();
	// Disabled controls don't show their own tooltip, so the reason sits on a wrapper.
	const lockedReason = $derived(isLastOwner ? m.last_owner() : undefined);

	let roleForm: HTMLFormElement;
	// Writable derived: follows the stored role and can be changed locally by the select.
	let role = $derived(member.role);

	async function submitRole() {
		// Let the hidden input pick up the new value before submitting.
		await tick();
		roleForm.requestSubmit();
	}
</script>

<Table.Row>
	<Table.Cell class="font-medium">
		{member.name}
		{#if isSelf}<span class="text-muted-foreground">({m.you()})</span>{/if}
	</Table.Cell>
	<Table.Cell>
		<div class="flex flex-wrap items-center gap-2">
			{member.email}
			{#if member.invitationPending}<Badge variant="outline">{m.invitation_pending()}</Badge>{/if}
		</div>
	</Table.Cell>
	<Table.Cell>
		<form method="POST" action="?/changeRole" bind:this={roleForm} use:enhance={() => async ({ result, update }) => {
			// A refused change (last owner) does not reload the data, so put the stored role back.
			if (result.type === 'failure') role = member.role;
			await update({ reset: false });
		}}>
			<input type="hidden" name="userId" value={member.userId} />
			<input type="hidden" name="role" value={role} />
			<span class="inline-block" title={lockedReason}>
				<Select.Root type="single" bind:value={role} onValueChange={submitRole} disabled={isLastOwner}>
					<Select.Trigger class="w-36" aria-label={`${m.role()}: ${member.name}`}>{roleLabel[role]()}</Select.Trigger>
					<Select.Content>
						{#each ROLES as r (r)}
							<Select.Item value={r} label={roleLabel[r]()} />
						{/each}
					</Select.Content>
				</Select.Root>
			</span>
		</form>
	</Table.Cell>
	<Table.Cell class="text-right">
		<div class="flex justify-end gap-1">
			{#if member.invitationPending}
				<form method="POST" action="?/resend" use:enhance>
					<input type="hidden" name="userId" value={member.userId} />
					<Button type="submit" variant="ghost" size="icon-sm" aria-label={`${m.resend_invitation()}: ${member.name}`} title={m.resend_invitation()}>
						<Mail />
					</Button>
				</form>
			{/if}
			<AlertDialog.Root>
				<span class="inline-block" title={lockedReason ?? m.remove()}>
					<AlertDialog.Trigger
						class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
						aria-label={`${m.remove()}: ${member.name}`}
						disabled={isLastOwner}
					>
						<Trash2 />
					</AlertDialog.Trigger>
				</span>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>{m.remove_member_confirm({ name: member.name, organizer })}</AlertDialog.Title>
						<AlertDialog.Description>{m.remove_member_description()}</AlertDialog.Description>
					</AlertDialog.Header>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="userId" value={member.userId} />
						<AlertDialog.Footer>
							<AlertDialog.Cancel type="button">{m.cancel()}</AlertDialog.Cancel>
							<AlertDialog.Action type="submit" class={buttonVariants({ variant: 'destructive' })}>{m.remove()}</AlertDialog.Action>
						</AlertDialog.Footer>
					</form>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</div>
	</Table.Cell>
</Table.Row>
