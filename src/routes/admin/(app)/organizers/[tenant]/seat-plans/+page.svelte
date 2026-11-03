<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import CreatePlanDialog from './create-plan-dialog.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const base = $derived(`/admin/organizers/${data.tenant.slug}/seat-plans`);
</script>

<div class="mb-4 flex items-center justify-between gap-4">
	<p class="text-sm text-muted-foreground">{m.seat_plans_description()}</p>
	<CreatePlanDialog />
</div>

{#if form?.action === 'delete' && form.error === 'in_use'}
	<Alert.Root variant="destructive" class="mb-4"><Alert.Description>{m.seat_plan_in_use()}</Alert.Description></Alert.Root>
{/if}

{#if data.plans.length === 0}
	<Card.Root><Card.Content class="text-muted-foreground">{m.no_seat_plans()}</Card.Content></Card.Root>
{:else}
	<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.plans as plan (plan.id)}
			<li>
				<Card.Root class="gap-3 overflow-hidden pt-0">
					<a href="{base}/{plan.id}" class="block aspect-video bg-muted">
						<img src="{base}/{plan.id}/image?v={plan.updatedAt.getTime()}" alt="" class="size-full object-contain" loading="lazy" />
					</a>
					<Card.Header>
						<Card.Title><a href="{base}/{plan.id}" class="hover:underline">{plan.name}</a></Card.Title>
						<Card.Description>
							{m.seat_count({ count: plan.seatCount })} · {m.used_by_events({ count: plan.eventCount })}
						</Card.Description>
						<Card.Action>
							<AlertDialog.Root>
								<AlertDialog.Trigger
									class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
									aria-label={`${m.delete()}: ${plan.name}`}
									title={plan.eventCount ? m.seat_plan_in_use() : m.delete()}
									disabled={plan.eventCount > 0}
								>
									<Trash2 />
								</AlertDialog.Trigger>
								<AlertDialog.Content>
									<AlertDialog.Header>
										<AlertDialog.Title>{m.delete_seat_plan_confirm({ name: plan.name })}</AlertDialog.Title>
									</AlertDialog.Header>
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="id" value={plan.id} />
										<AlertDialog.Footer>
											<AlertDialog.Cancel type="button">{m.cancel()}</AlertDialog.Cancel>
											<AlertDialog.Action type="submit" class={buttonVariants({ variant: 'destructive' })}>{m.delete()}</AlertDialog.Action>
										</AlertDialog.Footer>
									</form>
								</AlertDialog.Content>
							</AlertDialog.Root>
						</Card.Action>
					</Card.Header>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}
