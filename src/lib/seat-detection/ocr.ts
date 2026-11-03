// Reads the number printed in each seat box with Tesseract (digits only). The box is cut out,
// turned upright and enlarged first, so tilted plans read as well as straight ones.

import type { RgbaImage, SeatBox } from './boxes';

export interface ReadNumber {
	/** Digits read, '' if nothing could be read. */
	text: string;
	/** 0–100 as reported by Tesseract. */
	confidence: number;
	/** The readings disagreed or nothing was read; worth a human look. */
	uncertain: boolean;
}

/** Black and white at `threshold`; sharper edges help Tesseract with some digits, hurt with others. */
function binarize(crop: RgbaImage, threshold = 140): RgbaImage {
	const data = new Uint8ClampedArray(crop.data);
	for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = data[i] < threshold ? 0 : 255;
	return { ...crop, data };
}

/**
 * Each box is read three ways; their mistakes rarely coincide. On the test plans this gets
 * 246–248 of 248 numbers right, where any single way gets 228–245.
 */
const VARIANTS: ((image: RgbaImage, box: SeatBox) => RgbaImage)[] = [
	(image, box) => cropUpright(image, box, 3),
	(image, box) => binarize(cropUpright(image, box, 3)),
	(image, box) => binarize(cropUpright(image, box, 4))
];

/** The reading at least two variants agree on, else the most confident one (marked uncertain). */
export function combineReadings(readings: { text: string; confidence: number }[]): ReadNumber {
	const votes = new Map<string, number>();
	for (const r of readings) if (r.text) votes.set(r.text, (votes.get(r.text) ?? 0) + 1);
	const majority = [...votes].find(([, n]) => n >= 2)?.[0];
	if (majority) {
		const confidence = Math.max(...readings.filter((r) => r.text === majority).map((r) => r.confidence));
		return { text: majority, confidence, uncertain: false };
	}
	const best = readings.filter((r) => r.text).sort((a, b) => b.confidence - a.confidence)[0];
	return best ? { ...best, uncertain: true } : { text: '', confidence: 0, uncertain: true };
}

/**
 * The inside of `box` (frame trimmed), upright and scaled by `scale`, on a white margin.
 * Greyscale RGBA; `angle` is undone so text reads horizontally.
 */
export function cropUpright(image: RgbaImage, box: SeatBox, scale = 3, margin = 12): RgbaImage {
	// Trim the frame: a few pixels inside the box edge.
	const inset = Math.max(2, Math.min(box.width, box.height) * 0.08);
	const innerW = Math.max(1, box.width - 2 * inset);
	const innerH = Math.max(1, box.height - 2 * inset);
	const width = Math.round(innerW * scale) + 2 * margin;
	const height = Math.round(innerH * scale) + 2 * margin;
	const data = new Uint8ClampedArray(width * height * 4).fill(255);
	const cos = Math.cos(box.angle);
	const sin = Math.sin(box.angle);

	const lum = (x: number, y: number) => {
		if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 255;
		const p = (y * image.width + x) * 4;
		const a = image.data[p + 3] / 255;
		return (0.299 * image.data[p] + 0.587 * image.data[p + 1] + 0.114 * image.data[p + 2]) * a + 255 * (1 - a);
	};

	for (let oy = margin; oy < height - margin; oy++) {
		for (let ox = margin; ox < width - margin; ox++) {
			// Output pixel → position in the box (centred) → image coordinates.
			const u = (ox - margin + 0.5) / scale - innerW / 2;
			const v = (oy - margin + 0.5) / scale - innerH / 2;
			const x = box.x + u * cos - v * sin - 0.5;
			const y = box.y + u * sin + v * cos - 0.5;
			// Bilinear sampling.
			const x0 = Math.floor(x);
			const y0 = Math.floor(y);
			const fx = x - x0;
			const fy = y - y0;
			const value =
				lum(x0, y0) * (1 - fx) * (1 - fy) +
				lum(x0 + 1, y0) * fx * (1 - fy) +
				lum(x0, y0 + 1) * (1 - fx) * fy +
				lum(x0 + 1, y0 + 1) * fx * fy;
			const p = (oy * width + ox) * 4;
			data[p] = data[p + 1] = data[p + 2] = value;
		}
	}
	return { data, width, height };
}

/** The part of Tesseract's worker API used here. */
export interface OcrWorker {
	recognize(image: unknown): Promise<{ data: { text: string; confidence: number } }>;
}

/**
 * Reads all boxes, spreading the work over `workers`. `toInput` turns a crop into something
 * Tesseract accepts in the current environment (a canvas in the browser, a PNG buffer in Node).
 */
export async function readSeatNumbers(
	image: RgbaImage,
	boxes: SeatBox[],
	workers: OcrWorker[],
	toInput: (crop: RgbaImage) => unknown,
	onProgress?: (done: number, total: number) => void
): Promise<ReadNumber[]> {
	const results: ReadNumber[] = new Array(boxes.length);
	let nextIndex = 0;
	let done = 0;
	await Promise.all(
		workers.map(async (worker) => {
			while (nextIndex < boxes.length) {
				const i = nextIndex++;
				const readings = [];
				for (const variant of VARIANTS) {
					const { data } = await worker.recognize(toInput(variant(image, boxes[i])));
					readings.push({ text: data.text.replace(/\D/g, ''), confidence: data.confidence });
				}
				results[i] = combineReadings(readings);
				onProgress?.(++done, boxes.length);
			}
		})
	);
	return results;
}

/** Tesseract settings for reading one number per image. */
export const OCR_PARAMETERS = {
	tessedit_char_whitelist: '0123456789',
	// PSM 7: treat the image as a single text line.
	tessedit_pageseg_mode: '7'
} as const;
