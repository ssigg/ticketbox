// Seat geometry shared by the editor, the category painter and the server-side validation.
// Coordinates are image pixels; (x, y) is a seat's centre.

export interface SeatPosition {
	x: number;
	y: number;
}

export interface SeatLabel {
	section: string;
	row: string;
	number: string;
}

export interface SeatShape {
	width: number;
	height: number;
	/** Degrees, clockwise. */
	rotation: number;
}

export type PlanSeat = SeatPosition & SeatLabel & SeatShape;

export interface Rect {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * `count` square seats of `size` evenly spaced from `start` to `end` (both included), turned along
 * the row and numbered from `firstNumber` in steps of `step` — e.g. step 2 for theatres that number
 * odd seats on one side.
 */
export function generateRow(
	start: SeatPosition,
	end: SeatPosition,
	count: number,
	label: { section: string; row: string; firstNumber: number; step: number },
	size: number
): PlanSeat[] {
	const n = Math.max(1, Math.floor(count));
	const rotation = n === 1 ? 0 : (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
	return Array.from({ length: n }, (_, i) => {
		const t = n === 1 ? 0 : i / (n - 1);
		return {
			section: label.section,
			row: label.row,
			number: String(label.firstNumber + i * label.step),
			x: start.x + (end.x - start.x) * t,
			y: start.y + (end.y - start.y) * t,
			width: size,
			height: size,
			rotation
		};
	});
}

/** "A" → "B", "3" → "4", "12a" stays as it is. */
export function nextRowLabel(label: string): string {
	if (/^\d+$/.test(label)) return String(Number(label) + 1);
	if (/^[A-Y]$/i.test(label)) return String.fromCharCode(label.charCodeAt(0) + 1);
	return label;
}

/**
 * A number for a seat whose own reading is doubtful, from its neighbours in the row:
 * between 89 and 91 it must be 90. Null when the neighbours don't tell.
 */
export function suggestNumber(previous: string | undefined, next: string | undefined): string | null {
	const p = Number(previous);
	const n = Number(next);
	if (!previous || !next || !Number.isInteger(p) || !Number.isInteger(n)) return null;
	if (n - p === 2) return String(p + 1);
	if (p - n === 2) return String(n + 1);
	return null;
}

/** New numbers for `seats` in reading order (left to right, or right to left). Returns numbers in input order. */
export function renumber(seats: SeatPosition[], firstNumber: number, step: number, direction: 'ltr' | 'rtl'): string[] {
	const order = seats
		.map((seat, index) => ({ seat, index }))
		.sort((a, b) => (direction === 'ltr' ? a.seat.x - b.seat.x : b.seat.x - a.seat.x) || a.seat.y - b.seat.y);
	const numbers: string[] = new Array(seats.length);
	order.forEach(({ index }, i) => (numbers[index] = String(firstNumber + i * step)));
	return numbers;
}

export function normalizeRect(rect: Rect): Rect {
	return {
		x1: Math.min(rect.x1, rect.x2),
		y1: Math.min(rect.y1, rect.y2),
		x2: Math.max(rect.x1, rect.x2),
		y2: Math.max(rect.y1, rect.y2)
	};
}

/** Indices of the seats whose centre lies inside `rect`. */
export function seatsInRect(seats: SeatPosition[], rect: Rect): number[] {
	const r = normalizeRect(rect);
	return seats.flatMap((seat, i) => (seat.x >= r.x1 && seat.x <= r.x2 && seat.y >= r.y1 && seat.y <= r.y2 ? [i] : []));
}

export function labelKey(seat: SeatLabel): string {
	return JSON.stringify([seat.section.trim(), seat.row.trim(), seat.number.trim()]);
}

/** Indices of seats that share their section/row/number with another seat. */
export function duplicateLabels(seats: SeatLabel[]): number[] {
	const counts = new Map<string, number>();
	for (const seat of seats) counts.set(labelKey(seat), (counts.get(labelKey(seat)) ?? 0) + 1);
	return seats.flatMap((seat, i) => ((counts.get(labelKey(seat)) ?? 0) > 1 ? [i] : []));
}

/** The next free number in a row, for placing single seats one after another. */
export function nextNumber(seats: SeatLabel[], section: string, row: string): number {
	const used = seats
		.filter((s) => s.section === section && s.row === row)
		.map((s) => Number.parseInt(s.number, 10))
		.filter(Number.isFinite);
	return used.length ? Math.max(...used) + 1 : 1;
}
