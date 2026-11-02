<script lang="ts">
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import InviteDialog from './invite-dialog.svelte';
	import MemberRow from './member-row.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const ownerCount = $derived(data.members.filter((x) => x.role === 'owner').length);

	// Feedback for the last action; invite validation errors are shown inside the dialog instead.
	const feedback = $derived.by((): { ok: boolean; text: string } | null => {
		if (!form) return null;
		if ('error' in form && form.error === 'last_owner') return { ok: false, text: m.last_owner() };
		if ('result' in form && form.result) {
			const email = form.email ?? '';
			return { ok: true, text: form.result === 'invited' ? m.member_invited({ email }) : m.member_added({ email }) };
		}
		if ('name' in form && form.name) {
			return { ok: true, text: form.action === 'remove' ? m.member_removed({ name: form.name }) : m.role_changed({ name: form.name }) };
		}
		if (form.action === 'resend' && 'email' in form && form.email) return { ok: true, text: m.invitation_resent({ email: form.email }) };
		return null;
	});
</script>

<div class="mb-4 flex items-center justify-between gap-4">
	<h2 class="text-lg font-semibold">{m.members()}</h2>
	<InviteDialog />
</div>

{#if feedback}
	<Alert.Root class="mb-4" variant={feedback.ok ? 'default' : 'destructive'} role={feedback.ok ? 'status' : 'alert'}>
		<Alert.Description>{feedback.text}</Alert.Description>
	</Alert.Root>
{/if}

<Card.Root class="py-0">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>{m.name()}</Table.Head>
				<Table.Head>{m.email()}</Table.Head>
				<Table.Head>{m.role()}</Table.Head>
				<Table.Head><span class="sr-only">{m.remove()}</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.members as member (member.userId)}
				<MemberRow
					{member}
					organizer={data.tenant.name}
					isSelf={member.userId === data.user.id}
					isLastOwner={member.role === 'owner' && ownerCount === 1}
				/>
			{/each}
		</Table.Body>
	</Table.Root>
</Card.Root>
