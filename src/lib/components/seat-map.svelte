<script lang="ts" module>
	export interface MapSeat {
		key: string;
		x: number;
		y: number;
		width: number;
		height: number;
		/** Degrees, clockwise. */
		rotation: number;
		fill: string;
		/** Short text inside the seat, usually its number. */
		text?: string;
		/** Accessible name / tooltip, e.g. "Row 3, seat 12". */
		title: string;
		selected?: boolean;
		/** Red outline for errors, amber for things to check. */
		status?: 'error' | 'warning';
	}
	export interface MapPoint {
		x: number;
		y: number;
	}
</script>

<script lang="ts">
	import { Hash, Minus, Plus, Scan } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		imageUrl: string;
		width: number;
		height: number;
		seats: MapSeat[];
		cursor?: string;
		/** Draw seat numbers on top of the seats (plans with printed numbers don't need them). */
		showNumbers?: boolean;
		onseatdown?: (key: string, point: MapPoint, event: PointerEvent) => void;
		onbackgrounddown?: (point: MapPoint, event: PointerEvent) => void;
		onmove?: (point: MapPoint, event: PointerEvent) => void;
		onup?: (point: MapPoint, event: PointerEvent) => void;
		/** Extra SVG drawn between the image and the seats, in image coordinates (row lines, …). */
		underlay?: Snippet;
		/** Extra SVG drawn on top, in image coordinates (selection box, previews, …). */
		overlay?: Snippet;
		/** Extra controls next to the zoom buttons. */
		toolbar?: Snippet;
	}
	let {
		imageUrl,
		width,
		height,
		seats,
		cursor = 'default',
		showNumbers = $bindable(true),
		onseatdown,
		onbackgrounddown,
		onmove,
		onup,
		underlay,
		overlay,
		toolbar
	}: Props = $props();

	let svg: SVGSVGElement;
	// 0 = fit to the available width; otherwise screen pixels per image pixel.
	let zoom = $state(0);
	const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

	function toImage(event: PointerEvent): MapPoint {
		const matrix = svg.getScreenCTM()!.inverse();
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
		return { x: Math.max(0, Math.min(width, p.x)), y: Math.max(0, Math.min(height, p.y)) };
	}

	function zoomBy(direction: 1 | -1) {
		const scale = zoom || svg.getBoundingClientRect().width / width;
		const next = direction > 0 ? ZOOMS.find((z) => z > scale + 0.01) : [...ZOOMS].reverse().find((z) => z < scale - 0.01);
		zoom = next ?? zoom;
	}

	function down(event: PointerEvent) {
		if (event.button !== 0) return;
		const target = (event.target as Element).closest('[data-seat]');
		svg.setPointerCapture(event.pointerId);
		const point = toImage(event);
		if (target) onseatdown?.(target.getAttribute('data-seat')!, point, event);
		else onbackgrounddown?.(point, event);
	}

	const outline = (seat: MapSeat) =>
		seat.status === 'error' ? '#dc2626' : seat.status === 'warning' ? '#f59e0b' : seat.selected ? '#0f172a' : seat.fill;
</script>

<div class="grid gap-2">
	<div class="flex flex-wrap items-center gap-1">
		<Button type="button" variant="outline" size="icon-sm" onclick={() => zoomBy(-1)} aria-label={m.zoom_out()} title={m.zoom_out()}><Minus /></Button>
		<Button type="button" variant="outline" size="icon-sm" onclick={() => zoomBy(1)} aria-label={m.zoom_in()} title={m.zoom_in()}><Plus /></Button>
		<Button type="button" variant="outline" size="icon-sm" onclick={() => (zoom = 0)} aria-label={m.zoom_fit()} title={m.zoom_fit()}><Scan /></Button>
		<Button
			type="button"
			variant={showNumbers ? 'secondary' : 'outline'}
			size="icon-sm"
			aria-pressed={showNumbers}
			onclick={() => (showNumbers = !showNumbers)}
			aria-label={m.show_numbers()}
			title={m.show_numbers()}
		>
			<Hash />
		</Button>
		{@render toolbar?.()}
	</div>
	<div class="max-h-[75vh] overflow-auto rounded-lg border bg-white">
		<svg
			bind:this={svg}
			viewBox="0 0 {width} {height}"
			width={zoom ? width * zoom : '100%'}
			class="block touch-none select-none"
			style:cursor
			role="application"
			aria-label={m.seat_plan()}
			onpointerdown={down}
			onpointermove={(e) => onmove?.(toImage(e), e)}
			onpointerup={(e) => onup?.(toImage(e), e)}
		>
			<image href={imageUrl} {width} {height} />
			{@render underlay?.()}
			{#each seats as seat (seat.key)}
				{@const stroke = Math.max(1.5, Math.min(seat.width, seat.height) * (seat.selected || seat.status ? 0.16 : 0.08))}
				<g data-seat={seat.key} transform="translate({seat.x} {seat.y}) rotate({seat.rotation})">
					<title>{seat.title}</title>
					<!-- Translucent, so the plan's own drawing (and printed numbers) stays readable. -->
					<rect
						x={-seat.width / 2}
						y={-seat.height / 2}
						width={seat.width}
						height={seat.height}
						rx={Math.min(seat.width, seat.height) * 0.12}
						fill={seat.fill}
						fill-opacity={seat.selected ? 0.55 : 0.28}
						stroke={outline(seat)}
						stroke-width={stroke}
					/>
					{#if showNumbers && seat.text}
						<text
							text-anchor="middle"
							dominant-baseline="central"
							font-size={Math.min(seat.height * 0.6, seat.width / Math.max(2, seat.text.length) * 1.5)}
							class="pointer-events-none fill-slate-950 font-semibold"
							paint-order="stroke"
							stroke="white"
							stroke-width={Math.min(seat.width, seat.height) * 0.12}
						>
							{seat.text}
						</text>
					{/if}
				</g>
			{/each}
			{@render overlay?.()}
		</svg>
	</div>
</div>
