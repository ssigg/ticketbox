<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { ChevronLeft, Grip, MousePointer2, Plus, Rows3, Trash2 } from '@lucide/svelte';
	import SeatMap, { type MapPoint, type MapSeat } from '#lib/components/seat-map.svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { duplicateLabels, generateRow, nextNumber, renumber, seatsInRect, type PlanSeat, type Rect } from '#lib/seat-plan.ts';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type EditorSeat = PlanSeat & { key: string; id?: string };
	type Tool = 'select' | 'seat' | 'row';

	// Working copy; saved as a whole. Reset whenever the server data changes (load, save).
	let name = $state('');
	let seatSize = $state(16);
	let seats = $state<EditorSeat[]>([]);
	let saved = $state('');
	const snapshot = () => JSON.stringify({ name, seatSize, seats: seats.map(({ key: _, ...s }) => s) });
	$effect.pre(() => {
		name = data.plan.name;
		seatSize = data.plan.seatSize;
		seats = data.plan.seats.map((s) => ({ key: s.id, id: s.id, section: s.section, row: s.row, number: s.number, x: s.x, y: s.y }));
		// Reading the working copy here must not make this effect depend on it.
		saved = untrack(snapshot);
	});
	const dirty = $derived(snapshot() !== saved);

	let tool = $state<Tool>('select');
	let selected = $state<Set<string>>(new Set());
	let errorKeys = $state<Set<string>>(new Set());
	let newKey = 0;

	// Tool options
	let section = $state('');
	let row = $state('A');
	let rowCount = $state(10);
	let rowStep = $state(1);
	let rowFirst = $state(1);

	// Pointer interaction
	type Drag =
		| { kind: 'box'; start: MapPoint; end: MapPoint; additive: boolean }
		| { kind: 'move'; last: MapPoint; moved: boolean }
		| { kind: 'row'; start: MapPoint; end: MapPoint };
	let drag = $state<Drag | null>(null);

	const imageUrl = $derived(`/admin/organizers/${data.tenant.slug}/seat-plans/${data.plan.id}/image?v=${data.plan.updatedAt.getTime()}`);
	const duplicates = $derived(new Set(duplicateLabels(seats).map((i) => seats[i].key)));

	function title(seat: PlanSeat) {
		return [seat.section, seat.row && m.row_label({ row: seat.row }), m.seat_label({ number: seat.number })].filter(Boolean).join(', ');
	}

	const mapSeats = $derived<MapSeat[]>(
		seats.map((seat) => ({
			key: seat.key,
			x: seat.x,
			y: seat.y,
			fill: duplicates.has(seat.key) ? '#dc2626' : '#2563eb',
			text: seat.number,
			title: title(seat),
			selected: selected.has(seat.key),
			error: errorKeys.has(seat.key)
		}))
	);

	function add(list: PlanSeat[]) {
		const created = list.map((s) => ({ ...s, key: `new-${newKey++}` }));
		seats.push(...created);
		return created;
	}

	function select(keys: Iterable<string>, additive = false) {
		selected = new Set(additive ? [...selected, ...keys] : keys);
	}

	function onseatdown(key: string, point: MapPoint, event: PointerEvent) {
		if (tool !== 'select') return onbackgrounddown(point, event);
		if (event.shiftKey || event.metaKey || event.ctrlKey) {
			const next = new Set(selected);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			selected = next;
			return;
		}
		if (!selected.has(key)) select([key]);
		drag = { kind: 'move', last: point, moved: false };
	}

	function onbackgrounddown(point: MapPoint, event: PointerEvent) {
		if (tool === 'seat') {
			const [seat] = add([{ section, row, number: String(nextNumber(seats, section, row)), x: point.x, y: point.y }]);
			select([seat.key]);
		} else if (tool === 'row') {
			drag = { kind: 'row', start: point, end: point };
		} else {
			drag = { kind: 'box', start: point, end: point, additive: event.shiftKey || event.metaKey || event.ctrlKey };
		}
	}

	function onmove(point: MapPoint) {
		if (!drag) return;
		if (drag.kind === 'move') {
			const dx = point.x - drag.last.x;
			const dy = point.y - drag.last.y;
			for (const seat of seats) {
				if (!selected.has(seat.key)) continue;
				seat.x = Math.max(0, Math.min(data.plan.width, seat.x + dx));
				seat.y = Math.max(0, Math.min(data.plan.height, seat.y + dy));
			}
			drag.last = point;
			drag.moved = true;
		} else {
			drag.end = point;
		}
	}

	function onup(point: MapPoint) {
		if (!drag) return;
		if (drag.kind === 'box') {
			const rect: Rect = { x1: drag.start.x, y1: drag.start.y, x2: point.x, y2: point.y };
			select(seatsInRect(seats, rect).map((i) => seats[i].key), drag.additive);
		} else if (drag.kind === 'row') {
			const start = drag.start;
			// A click without dragging places a single seat at the start of the row.
			const count = Math.hypot(point.x - start.x, point.y - start.y) < seatSize ? 1 : rowCount;
			const created = add(generateRow(start, point, count, { section, row, firstNumber: rowFirst, step: rowStep }));
			select(created.map((s) => s.key));
			row = nextRowLabel(row);
		}
		drag = null;
	}

	/** "A" → "B", "3" → "4"; anything else stays as it is. */
	function nextRowLabel(label: string) {
		if (/^\d+$/.test(label)) return String(Number(label) + 1);
		if (/^[A-Y]$/i.test(label)) return String.fromCharCode(label.charCodeAt(0) + 1);
		return label;
	}

	const selectedSeats = $derived(seats.filter((s) => selected.has(s.key)));

	function remove() {
		seats = seats.filter((s) => !selected.has(s.key));
		selected = new Set();
	}

	// Bulk edit of the selection; empty fields leave values unchanged.
	let bulkSection = $state('');
	let bulkRow = $state('');
	let renumberFirst = $state(1);
	let renumberStep = $state(1);
	let renumberDir = $state<'ltr' | 'rtl'>('ltr');

	function applyLabels() {
		for (const seat of selectedSeats) {
			if (bulkSection.trim()) seat.section = bulkSection.trim();
			if (bulkRow.trim()) seat.row = bulkRow.trim();
		}
	}
	function applyRenumber() {
		const numbers = renumber(selectedSeats, renumberFirst, renumberStep, renumberDir);
		selectedSeats.forEach((seat, i) => (seat.number = numbers[i]));
	}

	function onkeydown(event: KeyboardEvent) {
		if ((event.target as Element).closest('input, textarea, [role="dialog"]')) return;
		if ((event.key === 'Delete' || event.key === 'Backspace') && selected.size) {
			event.preventDefault();
			remove();
		} else if (event.key === 'Escape') {
			selected = new Set();
			drag = null;
		} else if (event.key.startsWith('Arrow') && selected.size) {
			event.preventDefault();
			const step = event.shiftKey ? 10 : 1;
			const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key] ?? [0, 0];
			for (const seat of selectedSeats) {
				seat.x = Math.max(0, Math.min(data.plan.width, seat.x + dx));
				seat.y = Math.max(0, Math.min(data.plan.height, seat.y + dy));
			}
		} else if (event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			select(seats.map((s) => s.key));
		}
	}

	beforeNavigate((navigation) => {
		if (dirty && !confirm(m.unsaved_changes())) navigation.cancel();
	});

	let pending = $state(false);
	const tools: { id: Tool; label: () => string; hint: () => string; icon: typeof MousePointer2 }[] = [
		{ id: 'select', label: m.tool_select, hint: m.tool_select_hint, icon: MousePointer2 },
		{ id: 'seat', label: m.tool_seat, hint: m.tool_seat_hint, icon: Plus },
		{ id: 'row', label: m.tool_row, hint: m.tool_row_hint, icon: Rows3 }
	];
	const errorMessages: Record<string, () => string> = {
		duplicates: m.seat_plan_duplicates,
		out_of_bounds: m.seat_plan_out_of_bounds,
		invalid: m.check_input
	};
</script>

<svelte:window {onkeydown} onbeforeunload={(e) => dirty && e.preventDefault()} />

<a href="/admin/organizers/{data.tenant.slug}/seat-plans" class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
	<ChevronLeft class="size-4" /> {m.seat_plans()}
</a>

<form
	method="POST"
	action="?/save"
	class="mb-4 flex flex-wrap items-center justify-between gap-3"
	use:enhance={() => {
		pending = true;
		const sent = snapshot();
		const keys = seats.map((s) => s.key);
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'failure') {
				const indices = (result.data?.seats as number[]) ?? [];
				errorKeys = new Set(indices.map((i) => keys[i]));
				await update({ reset: false, invalidateAll: false });
			} else {
				errorKeys = new Set();
				saved = sent;
				await update({ reset: false });
			}
		};
	}}
>
	<h2 class="text-lg font-semibold">{name || data.plan.name}</h2>
	<input type="hidden" name="plan" value={JSON.stringify({ name, seatSize, seats: seats.map(({ key: _, ...s }) => s) })} />
	<div class="flex items-center gap-3">
		<span class="text-sm text-muted-foreground" role="status">
			{#if dirty}{m.unsaved()}{:else if form?.saved}{m.saved()}{/if}
		</span>
		<Button type="submit" disabled={pending || !dirty}>{m.save()}</Button>
	</div>
</form>

{#if form && 'error' in form && form.error && dirty}
	<Alert.Root variant="destructive" class="mb-4">
		<Alert.Description>{(errorMessages[form.error] ?? m.check_input)()}</Alert.Description>
	</Alert.Root>
{/if}

<div class="grid gap-4 lg:grid-cols-[1fr_18rem]">
	<SeatMap
		{imageUrl}
		width={data.plan.width}
		height={data.plan.height}
		{seatSize}
		seats={mapSeats}
		cursor={tool === 'select' ? 'default' : 'crosshair'}
		{onseatdown}
		{onbackgrounddown}
		{onmove}
		{onup}
	>
		{#snippet overlay()}
			{#if drag?.kind === 'box'}
				{@const r = { x: Math.min(drag.start.x, drag.end.x), y: Math.min(drag.start.y, drag.end.y), w: Math.abs(drag.end.x - drag.start.x), h: Math.abs(drag.end.y - drag.start.y) }}
				<rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#f59e0b22" stroke="#f59e0b" stroke-width={seatSize * 0.1} />
			{:else if drag?.kind === 'row'}
				{#each generateRow(drag.start, drag.end, rowCount, { section, row, firstNumber: rowFirst, step: rowStep }) as preview, i (i)}
					<circle cx={preview.x} cy={preview.y} r={seatSize / 2} fill="#2563eb88" />
				{/each}
			{/if}
		{/snippet}
	</SeatMap>

	<aside class="grid content-start gap-4">
		<Card.Root>
			<Card.Content class="grid gap-3">
				<div class="grid gap-2">
					<Label for="plan-name">{m.event_name()}</Label>
					<Input id="plan-name" bind:value={name} maxlength={100} />
				</div>
				<div class="grid gap-2">
					<Label for="seat-size">{m.seat_size()}</Label>
					<Input id="seat-size" type="number" min={2} max={500} bind:value={seatSize} />
				</div>
				<p class="text-sm text-muted-foreground">{m.seat_count({ count: seats.length })}</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="grid gap-3">
				<div class="grid grid-cols-3 gap-1" role="group" aria-label={m.tools()}>
					{#each tools as t (t.id)}
						<Button type="button" variant={tool === t.id ? 'default' : 'outline'} size="sm" aria-pressed={tool === t.id} onclick={() => (tool = t.id)}>
							<t.icon /> {t.label()}
						</Button>
					{/each}
				</div>
				<p class="text-xs text-muted-foreground">{tools.find((t) => t.id === tool)?.hint()}</p>
				{#if tool !== 'select'}
					<div class="grid grid-cols-2 gap-2">
						<div class="grid gap-1">
							<Label for="tool-section" class="text-xs">{m.section()}</Label>
							<Input id="tool-section" bind:value={section} maxlength={50} />
						</div>
						<div class="grid gap-1">
							<Label for="tool-row" class="text-xs">{m.row()}</Label>
							<Input id="tool-row" bind:value={row} maxlength={50} />
						</div>
						{#if tool === 'row'}
							<div class="grid gap-1">
								<Label for="row-count" class="text-xs">{m.seats_in_row()}</Label>
								<Input id="row-count" type="number" min={1} max={500} bind:value={rowCount} />
							</div>
							<div class="grid gap-1">
								<Label for="row-first" class="text-xs">{m.first_number()}</Label>
								<Input id="row-first" type="number" bind:value={rowFirst} />
							</div>
							<div class="col-span-2 grid gap-1">
								<Label for="row-step" class="text-xs">{m.number_step()}</Label>
								<Input id="row-step" type="number" min={1} max={10} bind:value={rowStep} />
							</div>
						{/if}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		{#if selectedSeats.length}
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.selected_seats({ count: selectedSeats.length })}</Card.Title>
					<Card.Action>
						<Button type="button" variant="ghost" size="icon-sm" onclick={remove} aria-label={m.delete_selected()} title={m.delete_selected()}><Trash2 /></Button>
					</Card.Action>
				</Card.Header>
				<Card.Content class="grid gap-3">
					{#if selectedSeats.length === 1}
						{@const seat = selectedSeats[0]}
						<div class="grid grid-cols-3 gap-2">
							<div class="grid gap-1"><Label for="s-section" class="text-xs">{m.section()}</Label><Input id="s-section" bind:value={seat.section} /></div>
							<div class="grid gap-1"><Label for="s-row" class="text-xs">{m.row()}</Label><Input id="s-row" bind:value={seat.row} /></div>
							<div class="grid gap-1"><Label for="s-number" class="text-xs">{m.number()}</Label><Input id="s-number" bind:value={seat.number} /></div>
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-2">
							<div class="grid gap-1"><Label for="b-section" class="text-xs">{m.section()}</Label><Input id="b-section" bind:value={bulkSection} placeholder={m.unchanged()} /></div>
							<div class="grid gap-1"><Label for="b-row" class="text-xs">{m.row()}</Label><Input id="b-row" bind:value={bulkRow} placeholder={m.unchanged()} /></div>
						</div>
						<Button type="button" variant="outline" size="sm" onclick={applyLabels}>{m.apply()}</Button>
						<div class="grid grid-cols-2 gap-2 border-t pt-3">
							<div class="grid gap-1"><Label for="r-first" class="text-xs">{m.first_number()}</Label><Input id="r-first" type="number" bind:value={renumberFirst} /></div>
							<div class="grid gap-1"><Label for="r-step" class="text-xs">{m.number_step()}</Label><Input id="r-step" type="number" min={1} bind:value={renumberStep} /></div>
						</div>
						<div class="grid grid-cols-2 gap-1" role="group" aria-label={m.direction()}>
							<Button type="button" size="sm" variant={renumberDir === 'ltr' ? 'secondary' : 'ghost'} aria-pressed={renumberDir === 'ltr'} onclick={() => (renumberDir = 'ltr')}>{m.left_to_right()}</Button>
							<Button type="button" size="sm" variant={renumberDir === 'rtl' ? 'secondary' : 'ghost'} aria-pressed={renumberDir === 'rtl'} onclick={() => (renumberDir = 'rtl')}>{m.right_to_left()}</Button>
						</div>
						<Button type="button" variant="outline" size="sm" onclick={applyRenumber}><Grip /> {m.renumber()}</Button>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}

		<p class="text-xs text-muted-foreground">{m.editor_shortcuts()}</p>
	</aside>
</div>
