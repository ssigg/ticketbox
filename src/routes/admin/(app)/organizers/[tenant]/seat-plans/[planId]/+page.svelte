<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { ChevronLeft, Grip, ListOrdered, MousePointer2, Plus, Rows3, Sparkles, Trash2, Wand2 } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import SeatMap, { type MapPoint, type MapSeat } from '#lib/components/seat-map.svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { detectSeatBoxes } from '#lib/seat-detection/boxes.ts';
	import { loadImagePixels, readNumbersInBrowser } from '#lib/seat-detection/browser.ts';
	import { findProblems, missingNumbers, rowGroups, type Problem, type RowGroup } from '#lib/seat-detection/review.ts';
	import {
		generateRow,
		nextNumber,
		nextRowLabel,
		renumber,
		seatsInRect,
		type PlanSeat,
		type Rect
	} from '#lib/seat-plan.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type EditorSeat = PlanSeat & { key: string; id?: string };
	type Tool = 'select' | 'seat' | 'row' | 'detect' | 'rows';

	// Working copy; saved as a whole. Reset whenever the server data changes (load, save).
	let name = $state('');
	let seatSize = $state(16);
	let seats = $state<EditorSeat[]>([]);
	let saved = $state('');
	const payload = () => ({ name, seatSize, seats: seats.map(({ key: _, ...s }) => s) });
	const snapshot = () => JSON.stringify(payload());
	$effect.pre(() => {
		name = data.plan.name;
		seatSize = data.plan.seatSize;
		seats = data.plan.seats.map((s) => ({
			key: s.id,
			id: s.id,
			section: s.section,
			row: s.row,
			number: s.number,
			x: s.x,
			y: s.y,
			width: s.width,
			height: s.height,
			rotation: s.rotation
		}));
		// Reading the working copy here must not make this effect depend on it.
		saved = untrack(snapshot);
	});
	const dirty = $derived(snapshot() !== saved);

	let tool = $state<Tool>(untrack(() => (data.plan.seats.length ? 'select' : 'detect')));
	let selected = $state<Set<string>>(new Set());
	let errorKeys = $state<Set<string>>(new Set());
	// Seats whose number reading was doubtful; cleared when the number is edited.
	let uncertain = $state<Set<string>>(new Set());
	let showNumbers = $state(true);
	let newKey = 0;

	// Tool options
	let section = $state('');
	let row = $state('A');
	let rowCount = $state(10);
	let rowStep = $state(1);
	let rowFirst = $state(1);
	let nextName = $state('1');

	type Drag =
		| { kind: 'box'; start: MapPoint; end: MapPoint; additive: boolean }
		| { kind: 'move'; last: MapPoint }
		| { kind: 'row'; start: MapPoint; end: MapPoint };
	let drag = $state<Drag | null>(null);

	const imageUrl = $derived(`/admin/organizers/${data.tenant.slug}/seat-plans/${data.plan.id}/image?v=${data.plan.updatedAt.getTime()}`);

	// Rows and problems are recomputed when editing pauses, not on every pointer move.
	let groups = $state<RowGroup[]>([]);
	$effect(() => {
		snapshot(); // re-run on any change to the seats
		if (drag?.kind === 'move') return;
		const current = $state.snapshot(seats) as EditorSeat[];
		const timer = setTimeout(() => (groups = rowGroups(current)), 120);
		return () => clearTimeout(timer);
	});
	const uncertainIndices = $derived(new Set(seats.flatMap((s, i) => (uncertain.has(s.key) ? [i] : []))));
	const problems = $derived(findProblems(seats, groups, uncertainIndices));
	const problemOf = $derived(new Map(problems.map((p) => [seats[p.seat]?.key, p])));
	const missing = $derived(missingNumbers(seats));

	function title(seat: PlanSeat) {
		return [seat.section, seat.row && m.row_label({ row: seat.row }), seat.number && m.seat_label({ number: seat.number })]
			.filter(Boolean)
			.join(', ');
	}

	const mapSeats = $derived<MapSeat[]>(
		seats.map((seat) => {
			const problem = problemOf.get(seat.key);
			return {
				key: seat.key,
				x: seat.x,
				y: seat.y,
				width: seat.width,
				height: seat.height,
				rotation: seat.rotation,
				fill: tool === 'rows' && !seat.row ? '#f59e0b' : '#2563eb',
				text: seat.number,
				title: title(seat),
				selected: selected.has(seat.key),
				status: errorKeys.has(seat.key) || problem?.kind === 'duplicate' || problem?.kind === 'missing_number' ? 'error' : problem ? 'warning' : undefined
			};
		})
	);

	function add(list: PlanSeat[]) {
		const created = list.map((s) => ({ ...s, key: `new-${newKey++}` }));
		seats.push(...created);
		return created;
	}

	function select(keys: Iterable<string>, additive = false) {
		selected = new Set(additive ? [...selected, ...keys] : keys);
	}

	// ── Detection ──
	let detecting = $state<{ stage: 'boxes' | 'numbers'; done: number; total: number } | null>(null);
	let detectError = $state<string | null>(null);

	async function detect(point: MapPoint) {
		detectError = null;
		detecting = { stage: 'boxes', done: 0, total: 0 };
		try {
			const image = await loadImagePixels(imageUrl);
			// Skip boxes where there is a seat already, so detection can be repeated to fill gaps.
			const boxes = detectSeatBoxes(image, { example: point }).filter(
				(box) => !seats.some((s) => Math.hypot(s.x - box.x, s.y - box.y) < Math.min(s.width, s.height) / 2)
			);
			if (!boxes.length) {
				detectError = m.detect_nothing_found();
				return;
			}
			detecting = { stage: 'numbers', done: 0, total: boxes.length };
			const numbers = await readNumbersInBrowser(image, boxes, (done, total) => (detecting = { stage: 'numbers', done, total }));
			const created = add(
				boxes.map((box, i) => ({
					section: '',
					row: '',
					number: numbers[i].text,
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height,
					rotation: (box.angle * 180) / Math.PI
				}))
			);
			uncertain = new Set([...uncertain, ...created.filter((_, i) => numbers[i].uncertain).map((s) => s.key)]);
			seatSize = Math.round(boxes.map((b) => Math.min(b.width, b.height)).sort((a, b) => a - b)[Math.floor(boxes.length / 2)]);
			// The plan has its own printed numbers; ours would cover them.
			showNumbers = false;
			select([]);
			tool = 'rows';
		} catch (e) {
			console.error(e);
			detectError = m.detect_failed();
		} finally {
			detecting = null;
		}
	}

	// ── Row naming ──
	function nameRowOf(key: string) {
		const index = seats.findIndex((s) => s.key === key);
		const group = groups.find((g) => g.segments.some((segment) => segment.includes(index)));
		const members = group ? group.segments.flat() : [index];
		for (const i of members) seats[i].row = nextName;
		nextName = nextRowLabel(nextName);
	}

	// ── Pointer handling ──
	function onseatdown(key: string, point: MapPoint, event: PointerEvent) {
		if (tool === 'rows') return nameRowOf(key);
		if (tool !== 'select') return onbackgrounddown(point, event);
		if (event.shiftKey || event.metaKey || event.ctrlKey) {
			const next = new Set(selected);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			selected = next;
			return;
		}
		if (!selected.has(key)) select([key]);
		drag = { kind: 'move', last: point };
	}

	function onbackgrounddown(point: MapPoint, event: PointerEvent) {
		if (tool === 'detect') {
			if (!detecting) detect(point);
		} else if (tool === 'seat') {
			const [seat] = add([
				{ section, row, number: String(nextNumber(seats, section, row)), x: point.x, y: point.y, width: seatSize, height: seatSize, rotation: 0 }
			]);
			select([seat.key]);
		} else if (tool === 'row') {
			drag = { kind: 'row', start: point, end: point };
		} else if (tool === 'select') {
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
			const created = add(generateRow(start, point, count, { section, row, firstNumber: rowFirst, step: rowStep }, seatSize));
			select(created.map((s) => s.key));
			row = nextRowLabel(row);
		}
		drag = null;
	}

	// ── Selection editing ──
	const selectedSeats = $derived(seats.filter((s) => selected.has(s.key)));

	function remove() {
		seats = seats.filter((s) => !selected.has(s.key));
		selected = new Set();
	}

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
		forget(selectedSeats.map((s) => s.key));
	}
	function forget(keys: string[]) {
		uncertain = new Set([...uncertain].filter((k) => !keys.includes(k)));
	}

	// ── Review ──
	const problemLabel: Record<Problem['kind'], () => string> = {
		missing_number: m.problem_missing_number,
		duplicate: m.problem_duplicate,
		sequence: m.problem_sequence,
		uncertain: m.problem_uncertain
	};
	function applySuggestion(problem: Problem) {
		const seat = seats[problem.seat];
		if (!seat || !problem.suggestion) return;
		seat.number = problem.suggestion;
		forget([seat.key]);
	}
	function applyAllSuggestions() {
		for (const problem of problems.filter((p) => p.suggestion)) applySuggestion(problem);
	}
	function confirmNumber(problem: Problem) {
		forget([seats[problem.seat].key]);
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
	const missingNumber = $derived(seats.some((s) => !s.number.trim()));
	const tools: { id: Tool; label: () => string; hint: () => string; icon: typeof MousePointer2 }[] = [
		{ id: 'detect', label: m.tool_detect, hint: m.tool_detect_hint, icon: Wand2 },
		{ id: 'rows', label: m.tool_rows, hint: m.tool_rows_hint, icon: ListOrdered },
		{ id: 'select', label: m.tool_select, hint: m.tool_select_hint, icon: MousePointer2 },
		{ id: 'seat', label: m.tool_seat, hint: m.tool_seat_hint, icon: Plus },
		{ id: 'row', label: m.tool_row, hint: m.tool_row_hint, icon: Rows3 }
	];
	const errorMessages: Record<string, () => string> = {
		duplicates: m.seat_plan_duplicates,
		out_of_bounds: m.seat_plan_out_of_bounds,
		invalid: m.check_input
	};
	const center = (indices: number[]) => indices.map((i) => seats[i]).filter(Boolean);
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
				uncertain = new Set();
				saved = sent;
				await update({ reset: false });
			}
		};
	}}
>
	<h2 class="text-lg font-semibold">{name || data.plan.name}</h2>
	<input type="hidden" name="plan" value={JSON.stringify(payload())} />
	<div class="flex items-center gap-3">
		<span class="text-sm text-muted-foreground" role="status">
			{#if dirty}{m.unsaved()}{:else if form?.saved}{m.saved()}{/if}
		</span>
		<Button type="submit" disabled={pending || !dirty || missingNumber} title={missingNumber ? m.problem_missing_number() : undefined}>{m.save()}</Button>
	</div>
</form>

{#if form && 'error' in form && form.error && dirty}
	<Alert.Root variant="destructive" class="mb-4">
		<Alert.Description>{(errorMessages[form.error] ?? m.check_input)()}</Alert.Description>
	</Alert.Root>
{/if}

<div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
	<SeatMap
		{imageUrl}
		width={data.plan.width}
		height={data.plan.height}
		seats={mapSeats}
		bind:showNumbers
		cursor={tool === 'select' ? 'default' : tool === 'rows' ? 'pointer' : 'crosshair'}
		{onseatdown}
		{onbackgrounddown}
		{onmove}
		{onup}
	>
		{#snippet underlay()}
			{#if tool === 'rows'}
				{@const lineWidth = Math.max(1, seatSize * 0.08)}
				{#each groups as group, g (g)}
					{@const color = group.name ? '#16a34a' : '#f59e0b'}
					{#each group.segments as segment, s (s)}
						<polyline points={center(segment).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} stroke-width={lineWidth} class="pointer-events-none" />
						{#if s > 0}
							{@const a = seats[group.segments[s - 1].at(-1)!]}
							{@const b = seats[segment[0]]}
							{#if a && b}
								<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} stroke-width={lineWidth} stroke-dasharray="{lineWidth * 3} {lineWidth * 2}" class="pointer-events-none" />
							{/if}
						{/if}
					{/each}
					{@const first = seats[group.segments[0]?.[0]]}
					{#if first}
						<!-- Left of the row, or just inside the image when the row starts at its edge. -->
						{@const labelX = first.x - first.width * 0.9}
						{@const fits = labelX > seatSize}
						<text
							x={fits ? labelX : 2}
							y={first.y}
							text-anchor={fits ? 'end' : 'start'}
							dominant-baseline="central"
							font-size={seatSize * 0.8}
							fill={color}
							stroke="white"
							stroke-width={seatSize * 0.15}
							paint-order="stroke"
							class="pointer-events-none font-bold"
						>
							{group.name ?? '?'}
						</text>
					{/if}
				{/each}
			{/if}
		{/snippet}
		{#snippet overlay()}
			{#if drag?.kind === 'box'}
				<rect
					x={Math.min(drag.start.x, drag.end.x)}
					y={Math.min(drag.start.y, drag.end.y)}
					width={Math.abs(drag.end.x - drag.start.x)}
					height={Math.abs(drag.end.y - drag.start.y)}
					fill="#f59e0b22"
					stroke="#f59e0b"
					stroke-width={seatSize * 0.1}
				/>
			{:else if drag?.kind === 'row'}
				{#each generateRow(drag.start, drag.end, rowCount, { section, row, firstNumber: rowFirst, step: rowStep }, seatSize) as preview, i (i)}
					<rect
						x={-seatSize / 2}
						y={-seatSize / 2}
						width={seatSize}
						height={seatSize}
						transform="translate({preview.x} {preview.y}) rotate({preview.rotation})"
						fill="#2563eb88"
					/>
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
				<p class="text-sm text-muted-foreground">{m.seat_count({ count: seats.length })}</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="grid gap-3">
				<div class="grid grid-cols-2 gap-1" role="group" aria-label={m.tools()}>
					{#each tools as t (t.id)}
						<Button type="button" variant={tool === t.id ? 'default' : 'outline'} size="sm" aria-pressed={tool === t.id} onclick={() => (tool = t.id)} class="justify-start">
							<t.icon /> {t.label()}
						</Button>
					{/each}
				</div>
				<p class="text-xs text-muted-foreground">{tools.find((t) => t.id === tool)?.hint()}</p>

				{#if tool === 'detect'}
					{#if detecting}
						<p class="text-sm" role="status">
							{#if detecting.stage === 'boxes'}{m.detect_finding_seats()}{:else}{m.detect_reading_numbers({ done: detecting.done, total: detecting.total })}{/if}
						</p>
						<div class="h-1.5 overflow-hidden rounded-full bg-muted">
							<div class="h-full bg-primary transition-all" style:width="{detecting.total ? (detecting.done / detecting.total) * 100 : 5}%"></div>
						</div>
					{/if}
					{#if detectError}
						<Alert.Root variant="destructive"><Alert.Description>{detectError}</Alert.Description></Alert.Root>
					{/if}
				{:else if tool === 'rows'}
					<div class="grid gap-1">
						<Label for="next-name" class="text-xs">{m.next_row_name()}</Label>
						<Input id="next-name" bind:value={nextName} maxlength={50} />
					</div>
				{:else if tool === 'seat' || tool === 'row'}
					<div class="grid grid-cols-2 gap-2">
						<div class="grid gap-1">
							<Label for="tool-section" class="text-xs">{m.section()}</Label>
							<Input id="tool-section" bind:value={section} maxlength={50} />
						</div>
						<div class="grid gap-1">
							<Label for="tool-row" class="text-xs">{m.row()}</Label>
							<Input id="tool-row" bind:value={row} maxlength={50} />
						</div>
						<div class="grid gap-1">
							<Label for="seat-size" class="text-xs">{m.seat_size()}</Label>
							<Input id="seat-size" type="number" min={2} max={500} bind:value={seatSize} />
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
							<div class="grid gap-1">
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
							<div class="grid gap-1">
								<Label for="s-number" class="text-xs">{m.number()}</Label>
								<Input id="s-number" bind:value={seat.number} oninput={() => forget([seat.key])} />
							</div>
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

		{#if problems.length || missing.length}
			<Card.Root>
				<Card.Header>
					<Card.Title><h3>{m.review()}</h3></Card.Title>
					<Card.Description>{m.review_hint()}</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-2">
					{#if problems.some((p) => p.suggestion)}
						<Button type="button" variant="outline" size="sm" onclick={applyAllSuggestions} class="justify-self-start"><Sparkles /> {m.apply_all()}</Button>
					{/if}
					{#if missing.length}
						<p class="text-sm"><span class="font-medium">{m.numbers_not_found()}</span> {missing.join(', ')}</p>
					{/if}
					<ul class="grid max-h-80 gap-1 overflow-auto" aria-label={m.review()}>
						{#each problems.slice(0, 100) as problem (seats[problem.seat]?.key)}
							{@const seat = seats[problem.seat]}
							{#if seat}
								<li class="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
									<button type="button" class="flex-1 text-left hover:underline" onclick={() => select([seat.key])}>
										<span class="font-medium tabular-nums">{seat.number || '–'}</span>
										<span class="text-muted-foreground">· {problemLabel[problem.kind]()}</span>
									</button>
									{#if problem.suggestion}
										<Button type="button" variant="ghost" size="xs" onclick={() => applySuggestion(problem)} title={m.use_suggestion()}>→ {problem.suggestion}</Button>
									{:else if problem.kind === 'uncertain'}
										<Button type="button" variant="ghost" size="xs" onclick={() => confirmNumber(problem)}>{m.looks_right()}</Button>
									{/if}
								</li>
							{/if}
						{/each}
					</ul>
				</Card.Content>
			</Card.Root>
		{/if}

		<p class="text-xs text-muted-foreground">{m.editor_shortcuts()}</p>
	</aside>
</div>
