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
	import { Contrast, Hash, Minus, Plus, Scan } from '@lucide/svelte';
	import { mode } from 'mode-watcher';
	import type { Snippet } from 'svelte';
	import { loadImagePixels } from '#lib/seat-detection/browser.ts';
	import { darkenDrawing, isLineDrawing, type Rgb } from '#lib/seat-plan-theme.ts';
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
		/** Converting the image in dark mode: auto = line drawings only, not photos. */
		darkMode?: 'auto' | 'on' | 'off';
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
		darkMode = 'auto',
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

	let scroller: HTMLDivElement;

	// ── Dark mode ──
	// The image is converted in the browser with the theme's own colours and shown as an object URL.
	let converted = $state<string | null>(null);
	let showOriginal = $state(false);
	const dark = $derived(mode.current === 'dark');
	const useConverted = $derived(dark && !!converted && !showOriginal);

	/** A CSS colour (any syntax, e.g. oklch) as RGB, by letting a canvas paint it. */
	function cssColor(value: string): Rgb {
		const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		context.fillStyle = value;
		context.fillRect(0, 0, 1, 1);
		const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	}

	$effect(() => {
		if (!dark || darkMode === 'off') return;
		const url = imageUrl;
		const mustConvert = darkMode === 'on';
		let cancelled = false;
		let objectUrl: string | null = null;
		(async () => {
			const pixels = await loadImagePixels(url);
			if (cancelled || (!mustConvert && !isLineDrawing(pixels))) return;
			const style = getComputedStyle(scroller);
			const background = cssColor(style.getPropertyValue('--card'));
			const text = cssColor(style.getPropertyValue('--foreground'));
			// Lines slightly softer than full text colour, so a dense plan doesn't glare.
			const foreground = text.map((c, i) => background[i] + (c - background[i]) * 0.85) as Rgb;
			const result = darkenDrawing(pixels, background, foreground);
			const canvas = document.createElement('canvas');
			canvas.width = result.width;
			canvas.height = result.height;
			canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(result.data), result.width, result.height), 0, 0);
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
			if (cancelled || !blob) return;
			objectUrl = URL.createObjectURL(blob);
			converted = objectUrl;
		})();
		return () => {
			cancelled = true;
			converted = null;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});

	function toImage(event: { clientX: number; clientY: number }): MapPoint {
		const matrix = svg.getScreenCTM()!.inverse();
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
		return { x: Math.max(0, Math.min(width, p.x)), y: Math.max(0, Math.min(height, p.y)) };
	}

	// ── Scrolling while dragging ──
	// Near or past an edge of the map (or the window), the plan scrolls, faster the further out the
	// pointer is, and the drag continues as if the pointer had moved over the plan.
	const EDGE = 48;
	let lastPointer: PointerEvent | null = null;
	let frame = 0;

	function edgeSpeed(position: number, start: number, end: number) {
		if (position < start + EDGE) return -Math.min(1, (start + EDGE - position) / (EDGE * 2));
		if (position > end - EDGE) return Math.min(1, (position - end + EDGE) / (EDGE * 2));
		return 0;
	}

	function autoScroll() {
		if (!lastPointer) return;
		const box = scroller.getBoundingClientRect();
		// Limit the map's edges to what is on screen.
		const top = Math.max(box.top, 0);
		const bottom = Math.min(box.bottom, window.innerHeight);
		const { clientX, clientY } = lastPointer;
		const dx = edgeSpeed(clientX, box.left, box.right) * 24;
		const dy = edgeSpeed(clientY, top, bottom) * 24;
		const before = [scroller.scrollLeft, scroller.scrollTop, window.scrollX, window.scrollY];
		scroller.scrollBy(dx, dy);
		// What the map can't scroll any further, the page scrolls (the map may reach below the window).
		if (scroller.scrollTop === before[1] && dy) window.scrollBy(0, dy);
		if (scroller.scrollLeft === before[0] && dx) window.scrollBy(dx, 0);
		const after = [scroller.scrollLeft, scroller.scrollTop, window.scrollX, window.scrollY];
		if (after.some((v, i) => v !== before[i])) onmove?.(toImage(lastPointer), lastPointer);
		frame = requestAnimationFrame(autoScroll);
	}

	function stopAutoScroll() {
		lastPointer = null;
		cancelAnimationFrame(frame);
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
		lastPointer = event;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(autoScroll);
	}

	function move(event: PointerEvent) {
		if (lastPointer) lastPointer = event;
		onmove?.(toImage(event), event);
	}

	function up(event: PointerEvent) {
		stopAutoScroll();
		onup?.(toImage(event), event);
	}

	const outline = (seat: MapSeat) =>
		seat.status === 'error'
			? '#dc2626'
			: seat.status === 'warning'
				? '#f59e0b'
				: seat.selected
					? dark && useConverted
						? '#f8fafc'
						: '#0f172a'
					: seat.fill;
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
		{#if dark && converted}
			<Button
				type="button"
				variant={showOriginal ? 'secondary' : 'outline'}
				size="icon-sm"
				aria-pressed={showOriginal}
				onclick={() => (showOriginal = !showOriginal)}
				aria-label={m.show_original()}
				title={m.show_original()}
			>
				<Contrast />
			</Button>
		{/if}
		{@render toolbar?.()}
	</div>
	<!-- Converted plans sit on the card colour; originals (and photos) keep a white frame. -->
	<div bind:this={scroller} class="max-h-[75vh] overflow-auto rounded-lg border {useConverted ? 'bg-card' : 'bg-white'}">
		<!-- Focusable so its keyboard shortcuts (delete, move, select all) reach the editor. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<svg
			bind:this={svg}
			viewBox="0 0 {width} {height}"
			width={zoom ? width * zoom : '100%'}
			class="block touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
			style:cursor
			role="application"
			tabindex="0"
			aria-label={m.seat_plan()}
			data-image={useConverted ? 'dark' : 'original'}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={stopAutoScroll}
			onlostpointercapture={stopAutoScroll}
		>
			<image href={useConverted ? converted : imageUrl} {width} {height} />
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
