// Runs seat detection in the browser: reads the plan image into pixels and drives Tesseract.
// Tesseract (and its language data) is only loaded when detection is used, from our own /ocr route.

import type { RgbaImage, SeatBox } from './boxes';
import { OCR_PARAMETERS, readSeatNumbers, type ReadNumber } from './ocr';

export async function loadImagePixels(url: string): Promise<RgbaImage> {
	const image = new Image();
	image.src = url;
	await image.decode();
	const canvas = document.createElement('canvas');
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const context = canvas.getContext('2d', { willReadFrequently: true })!;
	context.drawImage(image, 0, 0);
	return context.getImageData(0, 0, canvas.width, canvas.height);
}

function toCanvas(crop: RgbaImage): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = crop.width;
	canvas.height = crop.height;
	canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(crop.data), crop.width, crop.height), 0, 0);
	return canvas;
}

export async function readNumbersInBrowser(
	image: RgbaImage,
	boxes: SeatBox[],
	onProgress?: (done: number, total: number) => void
): Promise<ReadNumber[]> {
	const { createWorker } = await import('tesseract.js');
	const count = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
	const workers = await Promise.all(
		Array.from({ length: count }, async () => {
			const worker = await createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr/', langPath: '/ocr' });
			await worker.setParameters(OCR_PARAMETERS as never);
			return worker;
		})
	);
	try {
		return await readSeatNumbers(image, boxes, workers, toCanvas, onProgress);
	} finally {
		await Promise.all(workers.map((w) => w.terminate()));
	}
}
