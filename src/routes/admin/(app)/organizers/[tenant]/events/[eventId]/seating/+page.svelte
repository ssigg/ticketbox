<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Ban } from '@lucide/svelte';
	import SeatMap, { type MapPoint, type MapSeat } from '#lib/components/seat-map.svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { localized } from '#lib/localized.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { seatsInRect } from '#lib/seat-plan.ts';
	import { cn } from '#lib/utils.ts';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const NOT_FOR_SALE = '';
	const plan = $derived(data.seating.plan);
	const nameOf = (name: Partial<Record<string, string>>) => localized(name, getLocale(), data.tenant.defaultLocale);
	const colorOf = $derived(Object.fromEntries(data.categories.map((c) => [c.id, c.color])) as Record<string, string>);

	// seat id → category id; seats without an entry are not for sale.
	let assignments = $state<Record<string, string>>({});
	let saved = $state('');
	$effect.pre(() => {
		assignments = { ...data.seating.assignments };
		saved = untrack(() => JSON.stringify(assignments));
	});
	const dirty = $derived(JSON.stringify(assignments) !== saved);

	let brush = $state<string>(NOT_FOR_SALE);
	$effect.pre(() => {
		if (brush === NOT_FOR_SALE && data.categories.length) untrack(() => (brush = data.categories[0].id));
	});

	let box = $state<{ start: MapPoint; end: MapPoint } | null>(null);
	// Plans usually have their numbers printed; colours matter more here.
	let showNumbers = $state(false);

	function paint(seatIds: string[]) {
		const next = { ...assignments };
		for (const id of seatIds) {
			if (brush === NOT_FOR_SALE) delete next[id];
			else next[id] = brush;
		}
		assignments = next;
	}

	const mapSeats = $derived<MapSeat[]>(
		(plan?.seats ?? []).map((seat) => ({
			key: seat.id,
			x: seat.x,
			y: seat.y,
			width: seat.width,
			height: seat.height,
			rotation: seat.rotation,
			fill: colorOf[assignments[seat.id]] ?? '#9ca3af',
			text: seat.number,
			title: [seat.section, seat.row && m.row_label({ row: seat.row }), m.seat_label({ number: seat.number })].filter(Boolean).join(', ')
		}))
	);

	const counts = $derived.by(() => {
		const result: Record<string, number> = {};
		for (const seat of plan?.seats ?? []) {
			const key = assignments[seat.id] ?? NOT_FOR_SALE;
			result[key] = (result[key] ?? 0) + 1;
		}
		return result;
	});

	let newPlanId = $state('');
	const planName = (id: string) => data.plans.find((p) => p.id === id)?.name ?? '';

	beforeNavigate((navigation) => {
		if (dirty && !confirm(m.unsaved_changes())) navigation.cancel();
	});
	let pending = $state(false);
</script>

<svelte:window onbeforeunload={(e) => dirty && e.preventDefault()} />

{#snippet planPicker(label: string)}
	<!-- The confirm dialog is rendered outside this form, so its button refers to it by id. -->
	<form id="set-plan" method="POST" action="?/setPlan" use:enhance class="flex flex-wrap items-end gap-2">
		<div class="grid gap-2">
			<Label for="plan-select">{m.seat_plan()}</Label>
			<input type="hidden" name="planId" value={newPlanId} />
			<Select.Root type="single" bind:value={newPlanId}>
				<Select.Trigger id="plan-select" class="w-64">{planName(newPlanId) || m.choose_seat_plan()}</Select.Trigger>
				<Select.Content>
					{#each data.plans.filter((p) => p.id !== plan?.id) as p (p.id)}
						<Select.Item value={p.id} label={p.name}>{p.name} <span class="text-muted-foreground">· {m.seat_count({ count: p.seatCount })}</span></Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		{#if plan}
			<AlertDialog.Root>
				<AlertDialog.Trigger class={buttonVariants({ variant: 'outline' })} disabled={!newPlanId}>{label}</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>{m.change_seat_plan_confirm()}</AlertDialog.Title>
						<AlertDialog.Description>{m.change_seat_plan_description()}</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel type="button">{m.cancel()}</AlertDialog.Cancel>
						<AlertDialog.Action type="submit" form="set-plan">{label}</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{:else}
			<Button type="submit" disabled={!newPlanId}>{label}</Button>
		{/if}
	</form>
{/snippet}

{#if !plan}
	<Card.Root>
		<Card.Content class="grid gap-4">
			{#if data.plans.length === 0}
				<p class="text-muted-foreground">{m.no_seat_plans()}</p>
				<Button href="/admin/organizers/{data.tenant.slug}/seat-plans" variant="outline" class="justify-self-start">{m.seat_plans()}</Button>
			{:else}
				<p class="text-muted-foreground">{m.event_has_no_seat_plan()}</p>
				{@render planPicker(m.use_seat_plan())}
			{/if}
		</Card.Content>
	</Card.Root>
{:else}
	<form
		method="POST"
		action="?/save"
		class="mb-4 flex flex-wrap items-center justify-between gap-3"
		use:enhance={() => {
			pending = true;
			const sent = JSON.stringify(assignments);
			return async ({ result, update }) => {
				pending = false;
				if (result.type === 'success') saved = sent;
				await update({ reset: false });
			};
		}}
	>
		<p class="text-sm text-muted-foreground">{m.seating_description({ plan: plan.name })}</p>
		<input type="hidden" name="assignments" value={JSON.stringify(assignments)} />
		<div class="flex items-center gap-3">
			<span class="text-sm text-muted-foreground" role="status">
				{#if dirty}{m.unsaved()}{:else if form && 'saved' in form}{m.saved()}{/if}
			</span>
			<Button type="submit" disabled={pending || !dirty}>{m.save()}</Button>
		</div>
	</form>

	{#if data.categories.length === 0}
		<Alert.Root class="mb-4"><Alert.Description>{m.seating_needs_categories()}</Alert.Description></Alert.Root>
	{/if}

	<div class="grid gap-4 lg:grid-cols-[1fr_18rem]">
		<SeatMap
			imageUrl="/admin/organizers/{data.tenant.slug}/seat-plans/{plan.id}/image?v={plan.updatedAt.getTime()}"
			width={plan.width}
			height={plan.height}
			seats={mapSeats}
			bind:showNumbers
			cursor="crosshair"
			onseatdown={(key) => paint([key])}
			onbackgrounddown={(point) => (box = { start: point, end: point })}
			onmove={(point) => box && (box.end = point)}
			onup={(point) => {
				if (box && plan) paint(seatsInRect(plan.seats, { x1: box.start.x, y1: box.start.y, x2: point.x, y2: point.y }).map((i) => plan.seats[i].id));
				box = null;
			}}
		>
			{#snippet overlay()}
				{#if box}
					<rect
						x={Math.min(box.start.x, box.end.x)}
						y={Math.min(box.start.y, box.end.y)}
						width={Math.abs(box.end.x - box.start.x)}
						height={Math.abs(box.end.y - box.start.y)}
						fill="#f59e0b22"
						stroke="#f59e0b"
						stroke-width={plan.seatSize * 0.1}
					/>
				{/if}
			{/snippet}
		</SeatMap>

		<aside class="grid content-start gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.paint_with()}</Card.Title>
					<Card.Description>{m.paint_hint()}</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-1" role="radiogroup" aria-label={m.paint_with()}>
					{#each [...data.categories.map((c) => ({ id: c.id, label: nameOf(c.name), color: c.color })), { id: NOT_FOR_SALE, label: m.not_for_sale(), color: '#9ca3af' }] as option (option.id)}
						<button
							type="button"
							role="radio"
							aria-checked={brush === option.id}
							onclick={() => (brush = option.id)}
							class={cn(
								'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
								brush === option.id && 'bg-secondary font-medium ring-1 ring-ring'
							)}
						>
							{#if option.id === NOT_FOR_SALE}
								<Ban class="size-3.5 text-muted-foreground" />
							{:else}
								<span class="size-3.5 rounded-full" style:background-color={option.color} aria-hidden="true"></span>
							{/if}
							<span class="flex-1">{option.label}</span>
							<span class="text-muted-foreground tabular-nums" data-testid="count-{option.id || 'none'}">{counts[option.id] ?? 0}</span>
						</button>
					{/each}
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="grid gap-3">
					{@render planPicker(m.change_seat_plan())}
				</Card.Content>
			</Card.Root>
		</aside>
	</div>
{/if}
