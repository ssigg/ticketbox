import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { PlanSeat } from '../seat-plan';
import { detectSeatBoxes, type RgbaImage, type SeatBox } from './boxes';
import { findProblems, missingNumbers, rowGroups } from './review';
import { detectRows } from './rows';

const load = (file: string): RgbaImage => PNG.sync.read(readFileSync(file));
const degrees = (rad: number) => (rad * 180) / Math.PI;
const shape = (rows: ReturnType<typeof detectRows>) => rows.map((r) => r.segments.map((s) => s.length).join('+')).sort();

// Seats per row segment in tests/fixtures/plan.png (rows 1–18, left block + right block).
const PLAN_ROWS = ['13+5', '8+3', '7+3', '8+4', '7+4', '8+5', '9+6', '8+7', '9+7', '9+7', '9+7', '8+7', '9+7', '9+7', '5+2+5', '8+6', '8+6', '8'];

describe('seat boxes and rows on a real plan', () => {
	const plan = load('tests/fixtures/plan.png');

	it.each([
		['seat 1', { x: 22, y: 158 }],
		['seat 248', { x: 420, y: 1068 }],
		['seat 105 (next to a pillar)', { x: 733, y: 533 }]
	])('finds all 248 seats from %s, and no faint or blue boxes', (_, example) => {
		const boxes = detectSeatBoxes(plan, { example });
		expect(boxes).toHaveLength(248);
		for (const box of boxes) expect(Math.abs(degrees(box.angle))).toBeLessThan(2);
	});

	it('groups them into the 18 rows, split at aisles and pillars', () => {
		const rows = detectRows(detectSeatBoxes(plan, { example: { x: 22, y: 158 } }));
		expect(shape(rows)).toEqual([...PLAN_ROWS].sort());
	});

	it('finds nothing when the click is not on a seat', () => {
		expect(detectSeatBoxes(plan, { example: { x: 470, y: 600 } })).toEqual([]);
	});
});

describe('the same plan rotated by 25°', () => {
	const plan = load('tests/fixtures/plan-rotated.png');
	// Seat 1 of the original, rotated about the image centre.
	const a = (25 * Math.PI) / 180;
	const [dx, dy] = [22 - 400, 158 - 547.5];
	const example = { x: plan.width / 2 + dx * Math.cos(a) - dy * Math.sin(a), y: plan.height / 2 + dx * Math.sin(a) + dy * Math.cos(a) };

	it('finds the same seats and rows, turned by 25°', () => {
		const boxes = detectSeatBoxes(plan, { example });
		expect(boxes).toHaveLength(248);
		for (const box of boxes) expect(degrees(box.angle)).toBeCloseTo(25, -1);
		expect(shape(detectRows(boxes))).toEqual([...PLAN_ROWS].sort());
	});
});

/** White image with framed boxes (2 px dark frame, a dark "digit" bar inside). */
function drawBoxes(width: number, height: number, boxes: SeatBox[]): RgbaImage {
	const data = new Uint8ClampedArray(width * height * 4).fill(255);
	for (const box of boxes) {
		const r = Math.hypot(box.width, box.height) / 2 + 2;
		for (let y = Math.floor(box.y - r); y <= box.y + r; y++) {
			for (let x = Math.floor(box.x - r); x <= box.x + r; x++) {
				const dx = x + 0.5 - box.x;
				const dy = y + 0.5 - box.y;
				const u = dx * Math.cos(box.angle) + dy * Math.sin(box.angle);
				const v = -dx * Math.sin(box.angle) + dy * Math.cos(box.angle);
				const inOuter = Math.abs(u) <= box.width / 2 + 1 && Math.abs(v) <= box.height / 2 + 1;
				const inInner = Math.abs(u) < box.width / 2 - 1 && Math.abs(v) < box.height / 2 - 1;
				const digit = Math.abs(u) < 2 && Math.abs(v) < box.height / 4;
				if ((inOuter && !inInner) || digit) {
					const p = (y * width + x) * 4;
					data[p] = data[p + 1] = data[p + 2] = 0;
				}
			}
		}
	}
	return { data, width, height };
}

describe('curved rows', () => {
	// Six rows on arcs around a point above the image, with an aisle in the middle.
	const center = { x: 500, y: -350 };
	const boxes: SeatBox[] = [];
	for (let r = 0; r < 6; r++) {
		const radius = 520 + r * 45;
		const step = 33 / radius;
		for (let t = -0.55; t <= 0.55; t += step) {
			if (Math.abs(t) < step * 1.6) continue; // aisle
			boxes.push({ x: center.x + radius * Math.sin(t), y: center.y + radius * Math.cos(t), width: 28, height: 22, angle: -t });
		}
	}
	const image = drawBoxes(1000, 700, boxes);

	it('finds every seat and follows each curve as one row', () => {
		const found = detectSeatBoxes(image, { example: boxes[0] });
		expect(found).toHaveLength(boxes.length);
		const rows = detectRows(found);
		expect(rows).toHaveLength(6);
		for (const row of rows) expect(row.segments).toHaveLength(2);
	});
});

describe('review', () => {
	const seat = (number: string, x: number, row = ''): PlanSeat => ({ section: '', row, number, x, y: 100, width: 30, height: 24, rotation: 0 });

	it('suggests the number a row’s neighbours imply', () => {
		const seats = [seat('88', 30), seat('89', 63), seat('30', 96), seat('91', 129), seat('92', 162), seat('30', 400, '3')];
		expect(findProblems(seats, rowGroups(seats), new Set())).toEqual([{ seat: 2, kind: 'sequence', suggestion: '90' }]);
		// Within the same row it's also a duplicate.
		const sameRow = [seat('29', 30), seat('30', 63), seat('30', 96), seat('32', 129)];
		expect(findProblems(sameRow, rowGroups(sameRow), new Set())).toEqual([
			{ seat: 1, kind: 'duplicate', suggestion: null },
			{ seat: 2, kind: 'duplicate', suggestion: '31' }
		]);
	});

	it('lists missing and unclear numbers', () => {
		const seats = [seat('1', 30), seat('', 63), seat('3', 96), seat('4', 129)];
		expect(findProblems(seats, rowGroups(seats), new Set([3]))).toEqual([
			{ seat: 1, kind: 'missing_number', suggestion: '2' },
			{ seat: 3, kind: 'uncertain', suggestion: null }
		]);
		expect(missingNumbers([seat('1', 0), seat('2', 0), seat('5', 0)])).toEqual([3, 4]);
	});

	it('continues the numbering at a row’s end for flagged seats', () => {
		const seats = [seat('88', 30), seat('89', 63), seat('30', 96), seat('30', 400, '3')];
		const groups = rowGroups(seats);
		// Not a duplicate (other row) and no neighbour on the right: only flagged when unclear.
		expect(findProblems(seats, groups, new Set())).toEqual([]);
		expect(findProblems(seats, groups, new Set([2]))).toEqual([{ seat: 2, kind: 'uncertain', suggestion: '90' }]);
	});
});
