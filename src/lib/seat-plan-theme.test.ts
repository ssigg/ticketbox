import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { RgbaImage } from './seat-detection/boxes';
import { darkenDrawing, hueOf, isLineDrawing, type Rgb } from './seat-plan-theme';

const plan: RgbaImage = PNG.sync.read(readFileSync('tests/fixtures/plan.png'));
const background: Rgb = [24, 24, 27];
const foreground: Rgb = [250, 250, 250];
const at = (image: RgbaImage, x: number, y: number): Rgb => {
	const p = (y * image.width + x) * 4;
	return [image.data[p], image.data[p + 1], image.data[p + 2]];
};
const lum = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b;

describe('isLineDrawing', () => {
	it('recognises the seat plan as a drawing', () => {
		expect(isLineDrawing(plan)).toBe(true);
	});

	it('leaves photo-like images alone', () => {
		// Smooth colourful gradients, like a photo of a hall.
		const width = 200;
		const height = 150;
		const data = new Uint8ClampedArray(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const p = (y * width + x) * 4;
				data.set([60 + x, 40 + y, 120 + ((x * y) % 100), 255], p);
			}
		}
		expect(isLineDrawing({ data, width, height })).toBe(false);
	});
});

describe('darkenDrawing', () => {
	const dark = darkenDrawing(plan, background, foreground);

	it('turns the paper into the theme background and lines light', () => {
		// White paper between stage and row 1, the stage frame, a seat frame, a printed digit.
		expect(at(dark, 470, 110)).toEqual(background);
		expect(lum(at(dark, 300, 63))).toBeGreaterThan(200);
		expect(lum(at(dark, 4, 158))).toBeGreaterThan(200);
	});

	it('keeps the blue blocks blue and dark', () => {
		const original = at(plan, 128, 250);
		const converted = at(dark, 128, 250);
		expect(Math.abs(hueOf(converted) - hueOf(original))).toBeLessThan(5);
		expect(lum(converted)).toBeLessThan(150);
		expect(lum(converted)).toBeGreaterThan(lum(background) + 20);
	});

	it('treats pale tints as paper', () => {
		const tinted = { data: new Uint8ClampedArray([235, 240, 252, 255]), width: 1, height: 1 };
		const [r, g, b] = darkenDrawing(tinted, background, foreground).data;
		expect(Math.max(r, g, b)).toBeLessThan(60);
	});

	it('keeps size and transparency', () => {
		expect([dark.width, dark.height]).toEqual([plan.width, plan.height]);
		expect(dark.data[3]).toBe(plan.data[3]);
	});
});
