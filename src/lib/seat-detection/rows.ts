// Groups seats into rows without assuming a direction: neighbouring seats are chained as long as the
// chain keeps its direction (straight, diagonal or gently curved). Chains interrupted by an aisle or
// a pillar become separate segments; segments that continue each other are suggested as one row.

export interface Center {
	x: number;
	y: number;
}

export interface DetectedRow {
	/** Seat indices in order along the row; segments are listed in order too. */
	segments: number[][];
}

function median(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function unit(dx: number, dy: number) {
	const length = Math.hypot(dx, dy) || 1;
	return { x: dx / length, y: dy / length };
}

/** Typical distance between neighbouring seats. */
export function seatSpacing(seats: Center[]): number {
	return median(
		seats.map((a, i) => {
			let best = Infinity;
			seats.forEach((b, j) => {
				if (i !== j) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y));
			});
			return best;
		})
	);
}

/** Chains of seats; each seat links to at most two neighbours on opposite sides. */
export function chainSegments(seats: Center[], spacing = seatSpacing(seats)): number[][] {
	const maxLink = spacing * 1.4;
	const choices = seats.map((a, i) => {
		const candidates = seats
			.map((b, j) => ({ j, d: Math.hypot(b.x - a.x, b.y - a.y) }))
			.filter(({ j, d }) => j !== i && d <= maxLink)
			.sort((p, q) => p.d - q.d);
		if (!candidates.length) return [];
		const first = candidates[0];
		const u = unit(seats[first.j].x - a.x, seats[first.j].y - a.y);
		// The second neighbour must lie on the other side (within ±35° of straight on).
		const second = candidates.find(({ j }) => {
			const v = unit(seats[j].x - a.x, seats[j].y - a.y);
			return u.x * v.x + u.y * v.y < -0.82;
		});
		return second ? [first.j, second.j] : [first.j];
	});

	// Keep links both seats agree on.
	const links = seats.map(() => [] as number[]);
	choices.forEach((list, i) => {
		for (const j of list) if (choices[j].includes(i) && !links[i].includes(j)) links[i].push(j), links[j].push(i);
	});

	const visited = new Set<number>();
	const segments: number[][] = [];
	const walk = (start: number) => {
		const path = [start];
		visited.add(start);
		let previous = -1;
		let current = start;
		for (;;) {
			const next = links[current].find((n) => n !== previous && !visited.has(n));
			if (next === undefined) break;
			path.push(next);
			visited.add(next);
			previous = current;
			current = next;
		}
		return path;
	};
	// Start at chain ends first, then whatever is left (closed loops).
	for (let i = 0; i < seats.length; i++) if (!visited.has(i) && links[i].length <= 1) segments.push(walk(i));
	for (let i = 0; i < seats.length; i++) if (!visited.has(i)) segments.push(walk(i));

	// Reading order: left to right, or top to bottom for (nearly) vertical rows.
	return segments.map((path) => {
		const a = seats[path[0]];
		const b = seats[path[path.length - 1]];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		return (Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0) ? path.reverse() : path;
	});
}

/** Signed angle from u to v, radians. */
function turn(u: { x: number; y: number }, v: { x: number; y: number }) {
	return Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
}

/**
 * How much a segment bends per pixel, in reading direction (radians/px, positive = clockwise on
 * screen), measured over up to four links. 0 for straight rows and segments under three seats.
 */
function curvature(seats: Center[], segment: number[]): number {
	if (segment.length < 3) return 0;
	let angle = 0;
	let length = 0;
	const links = Math.min(4, segment.length - 2);
	for (let k = 0; k < links; k++) {
		// Use both ends of the segment, so the estimate covers where gaps are joined.
		for (const idx of [k, segment.length - 3 - k]) {
			const [a, b, c] = [seats[segment[idx]], seats[segment[idx + 1]], seats[segment[idx + 2]]];
			angle += turn(unit(b.x - a.x, b.y - a.y), unit(c.x - b.x, c.y - b.y));
			length += Math.hypot(c.x - b.x, c.y - b.y);
		}
	}
	return angle / length;
}

/** Direction in which a segment continues past its end (or its start, `atStart`). */
function endDirection(seats: Center[], segment: number[], atStart: boolean) {
	if (segment.length < 2) return null;
	const [inner, end] = atStart ? [segment[1], segment[0]] : [segment[segment.length - 2], segment[segment.length - 1]];
	return unit(seats[end].x - seats[inner].x, seats[end].y - seats[inner].y);
}

/**
 * Rows: segments joined where one continues the other across a gap of up to `maxGapSeats` seats.
 * The gap is expected to continue the segments' bend (none for straight rows): on a curve, the line
 * across the gap leaves one end turned by half the total bend and reaches the other turned by the
 * other half. Joins must match that within 6° and half a seat sideways, so a row never jumps to the
 * next one.
 */
export function detectRows(seats: Center[], maxGapSeats = 8): DetectedRow[] {
	if (!seats.length) return [];
	const spacing = seatSpacing(seats);
	const segments = chainSegments(seats, spacing);

	type End = { segment: number; atStart: boolean; point: Center; dir: { x: number; y: number } | null };
	const bends = segments.map((segment) => curvature(seats, segment));
	const ends: End[] = segments.flatMap((segment, s) => [
		{ segment: s, atStart: true, point: seats[segment[0]], dir: endDirection(seats, segment, true) },
		{ segment: s, atStart: false, point: seats[segment[segment.length - 1]], dir: endDirection(seats, segment, false) }
	]);

	const tolerance = (6 * Math.PI) / 180;
	/** Whether going along `dir` and turning by `expected` leads along `v` over `length`. */
	const aligned = (dir: { x: number; y: number } | null, v: { x: number; y: number }, expected: number, length: number) => {
		if (!dir) return true; // single seats take the direction of the segment they join
		const error = turn(dir, v) - expected;
		return Math.abs(error) <= tolerance && Math.abs(Math.sin(error)) * length <= spacing / 2;
	};

	const candidates: { a: End; b: End; distance: number }[] = [];
	for (const a of ends) {
		for (const b of ends) {
			// Join a segment's end to another segment's start, so the reading order is kept.
			if (a.segment === b.segment || a.atStart || !b.atStart) continue;
			if (!a.dir && !b.dir) continue;
			const dx = b.point.x - a.point.x;
			const dy = b.point.y - a.point.y;
			const distance = Math.hypot(dx, dy);
			if (distance > spacing * (maxGapSeats + 1)) continue;
			const v = unit(dx, dy);
			// b.dir points out of b's start; the row continues the other way.
			const into = b.dir && { x: -b.dir.x, y: -b.dir.y };
			const known = [a, b].filter((end) => segments[end.segment].length >= 3).map((end) => bends[end.segment]);
			const bend = known.length ? (known.reduce((sum, k) => sum + k, 0) / known.length) * distance : 0;
			if (aligned(a.dir, v, bend / 2, distance) && aligned(into, v, -bend / 2, distance)) candidates.push({ a, b, distance });
		}
	}
	candidates.sort((p, q) => p.distance - q.distance);

	// Greedy: closest joins first; each end joins once.
	const next = new Map<number, number>();
	const previous = new Map<number, number>();
	for (const { a, b } of candidates) {
		if (next.has(a.segment) || previous.has(b.segment)) continue;
		// Don't close a loop.
		let s: number | undefined = b.segment;
		while (s !== undefined && s !== a.segment) s = next.get(s);
		if (s === a.segment) continue;
		next.set(a.segment, b.segment);
		previous.set(b.segment, a.segment);
	}

	const rows: DetectedRow[] = [];
	segments.forEach((_, s) => {
		if (previous.has(s)) return;
		const row: number[][] = [];
		for (let t: number | undefined = s; t !== undefined; t = next.get(t)) row.push(segments[t]);
		rows.push({ segments: row });
	});
	return rows;
}
