import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createWorker } from 'tesseract.js';
import { describe, expect, it } from 'vitest';
import { detectSeatBoxes, type RgbaImage } from '../../src/lib/seat-detection/boxes';
import { OCR_PARAMETERS, readSeatNumbers } from '../../src/lib/seat-detection/ocr';
import { findProblems, rowGroups } from '../../src/lib/seat-detection/review';
import type { PlanSeat } from '../../src/lib/seat-plan';

// Real OCR, with the English model from node_modules (as served to browsers by /ocr).
const langPath = 'node_modules/@tesseract.js-data/eng/4.0.0_best_int';
const toPng = (crop: RgbaImage) => PNG.sync.write(Object.assign(new PNG({ width: crop.width, height: crop.height }), { data: Buffer.from(crop.data) }));

async function readPlan(file: string, example: { x: number; y: number }) {
	const image: RgbaImage = PNG.sync.read(readFileSync(file));
	const boxes = detectSeatBoxes(image, { example });
	const workers = await Promise.all(
		[0, 1, 2, 3].map(async () => {
			const worker = await createWorker('eng', 1, { langPath, cacheMethod: 'none' });
			await worker.setParameters(OCR_PARAMETERS as never);
			return worker;
		})
	);
	try {
		const numbers = await readSeatNumbers(image, boxes, workers, toPng);
		const seats: PlanSeat[] = boxes.map((box, i) => ({
			section: '',
			row: '',
			number: numbers[i].text,
			x: box.x,
			y: box.y,
			width: box.width,
			height: box.height,
			rotation: (box.angle * 180) / Math.PI
		}));
		return { seats, uncertain: new Set(numbers.flatMap((n, i) => (n.uncertain ? [i] : []))) };
	} finally {
		await Promise.all(workers.map((w) => w.terminate()));
	}
}

/** The plan is numbered 1…248 row by row, left to right — the reading order of the detected rows. */
function expectedNumbers(seats: PlanSeat[]) {
	const groups = rowGroups(seats).sort((a, b) => seats[a.segments[0][0]].y - seats[b.segments[0][0]].y);
	const expected = new Map<number, string>();
	groups.flatMap((g) => g.segments.flat()).forEach((seat, k) => expected.set(seat, String(k + 1)));
	return expected;
}

describe('reading seat numbers', () => {
	it.each([
		['tests/fixtures/plan.png', { x: 22, y: 158 }],
		// Seat 1 rotated with the image.
		['tests/fixtures/plan-rotated.png', { x: 416, y: 152.7 }]
	])('reads %s nearly perfectly and flags every mistake with the right fix', async (file, example) => {
		const { seats, uncertain } = await readPlan(file, example);
		expect(seats).toHaveLength(248);
		const expected = expectedNumbers(seats);
		const wrong = seats.flatMap((s, i) => (s.number !== expected.get(i) ? [i] : []));
		expect(wrong.length).toBeLessThanOrEqual(3);

		const problems = findProblems(seats, rowGroups(seats), uncertain);
		for (const i of wrong) {
			const problem = problems.find((p) => p.seat === i);
			expect(problem, `seat ${expected.get(i)} read as "${seats[i].number}" is flagged`).toBeDefined();
			expect(problem!.suggestion).toBe(expected.get(i));
		}
	}, 120_000);
});
