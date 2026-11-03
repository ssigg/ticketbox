// Dark mode for seat plan images: line drawings (dark lines on white paper) are converted so the
// paper takes the theme's background and lines become light, while coloured areas keep their hue.
// Photos are left alone. Pure functions on RGBA pixels; the seat map runs them in the browser.

import type { RgbaImage } from './seat-detection/boxes';

export type Rgb = [number, number, number];

/** How saturated a pixel is, 0 (grey) … 1. */
function chroma(r: number, g: number, b: number) {
	return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function luminance(r: number, g: number, b: number) {
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Whether the image is a drawing on white paper rather than a photo: most pixels are light grey
 * or white, and nearly all are unsaturated. Samples about 20 000 pixels.
 */
export function isLineDrawing(image: RgbaImage): boolean {
	const total = image.width * image.height;
	const step = Math.max(1, Math.floor(total / 20000));
	let samples = 0;
	let paper = 0;
	let neutral = 0;
	for (let i = 0; i < total; i += step) {
		const p = i * 4;
		const [r, g, b] = [image.data[p], image.data[p + 1], image.data[p + 2]];
		samples++;
		if (chroma(r, g, b) < 0.12) {
			neutral++;
			if (luminance(r, g, b) > 0.85) paper++;
		}
	}
	return paper / samples > 0.5 && neutral / samples > 0.8;
}

function rgbToHsl(r: number, g: number, b: number): Rgb {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
	if (s === 0) return [l * 255, l * 255, l * 255];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const channel = (t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/**
 * The drawing for a dark theme. Grey pixels are inverted between `background` (where the paper
 * was white) and `foreground` (where lines were black). Coloured pixels keep hue and saturation
 * and get a lightness in the middle range, so dark colours stay visible on the dark background.
 * Pixels in between are blended by their saturation, which keeps anti-aliased edges smooth;
 * pale tints count as paper.
 */
export function darkenDrawing(image: RgbaImage, background: Rgb, foreground: Rgb): RgbaImage {
	const data = new Uint8ClampedArray(image.data.length);
	for (let p = 0; p < data.length; p += 4) {
		const [r, g, b, a] = [image.data[p], image.data[p + 1], image.data[p + 2], image.data[p + 3]];
		const lum = luminance(r, g, b);
		// Grey: 1 when unsaturated, 0 from a chroma of 0.25 on. Very light pixels count as paper even
		// when slightly tinted, e.g. compression noise next to coloured areas.
		const grey = Math.max(0, 1 - chroma(r, g, b) / 0.25, Math.min(1, (lum - 0.75) / 0.15));
		const ink = 1 - lum;
		const neutral = background.map((c, i) => c + (foreground[i] - c) * ink);
		let colored = neutral;
		if (grey < 1) {
			const [h, s, l] = rgbToHsl(r, g, b);
			colored = hslToRgb(h, s, 0.3 + 0.4 * l);
		}
		data[p] = neutral[0] * grey + colored[0] * (1 - grey);
		data[p + 1] = neutral[1] * grey + colored[1] * (1 - grey);
		data[p + 2] = neutral[2] * grey + colored[2] * (1 - grey);
		data[p + 3] = a;
	}
	return { data, width: image.width, height: image.height };
}

/** Hue of a colour in degrees (for tests and checks). */
export function hueOf([r, g, b]: Rgb): number {
	return rgbToHsl(r, g, b)[0] * 360;
}
