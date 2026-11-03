<script lang="ts" module>
	export interface MapSeat {
		key: string;
		x: number;
		y: number;
		fill: string;
		/** Short text inside the seat, usually its number. */
		text?: string;
		/** Accessible name / tooltip, e.g. "Row 3, seat 12". */
		title: string;
		selected?: boolean;
		error?: boolean;
	}
	export interface MapPoint {
		x: number;
		y: number;
	}
</script>

<script lang="ts">
	import { Minus, Plus, Scan } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		imageUrl: string;
		width: number;
		height: number;
		seatSize: number;
		seats: MapSeat[];
		cursor?: string;
		onseatdown?: (key: string, point: MapPoint, event: PointerEvent) => void;
		onbackgrounddown?: (point: MapPoint, event: PointerEvent) => void;
		onmove?: (point: MapPoint, event: PointerEvent) => void;
		onup?: (point: MapPoint, event: PointerEvent) => void;
		/** Extra SVG drawn on top, in image coordinates (selection box, row preview, …). */
		overlay?: Snippet;
	}
	let { imageUrl, width, height, seatSize, seats, cursor = 'default', onseatdown, onbackgrounddown, onmove, onup, overlay }: Props = $props();

	let svg: SVGSVGElement;
	// 0 = fit to the available width; otherwise image pixels per screen pixel.
	let zoom = $state(0);
	const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

	function toImage(event: PointerEvent): MapPoint {
		const matrix = svg.getScreenCTM()!.inverse();
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
		return { x: Math.max(0, Math.min(width, p.x)), y: Math.max(0, Math.min(height, p.y)) };
	}

	function currentScale() {
		return svg ? svg.getBoundingClientRect().width / width : 1;
	}
	function zoomBy(direction: 1 | -1) {
		const scale = zoom || currentScale();
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

	const fontSize = $derived(seatSize * 0.55);
</script>

<div class="grid gap-2">
	<div class="flex items-center gap-1">
		<Button type="button" variant="outline" size="icon-sm" onclick={() => zoomBy(-1)} aria-label={m.zoom_out()} title={m.zoom_out()}><Minus /></Button>
		<Button type="button" variant="outline" size="icon-sm" onclick={() => zoomBy(1)} aria-label={m.zoom_in()} title={m.zoom_in()}><Plus /></Button>
		<Button type="button" variant="outline" size="icon-sm" onclick={() => (zoom = 0)} aria-label={m.zoom_fit()} title={m.zoom_fit()}><Scan /></Button>
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
			{#each seats as seat (seat.key)}
				<g data-seat={seat.key} transform="translate({seat.x} {seat.y})">
					<title>{seat.title}</title>
					<circle
						r={seatSize / 2}
						fill={seat.fill}
						stroke={seat.error ? '#dc2626' : seat.selected ? '#f59e0b' : 'white'}
						stroke-width={seat.selected || seat.error ? seatSize * 0.18 : seatSize * 0.06}
					/>
					{#if seat.text && seatSize >= 12}
						<text text-anchor="middle" dominant-baseline="central" font-size={fontSize} fill="white" class="pointer-events-none font-medium">
							{seat.text}
						</text>
					{/if}
				</g>
			{/each}
			{@render overlay?.()}
		</svg>
	</div>
</div>
