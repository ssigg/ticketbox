// Finds the seat boxes drawn on a seat plan image: light areas enclosed by dark lines that are
// about as large as an example seat. Works for boxes at any angle. Pure TypeScript, runs in the
// browser (canvas ImageData) and in Node (tests).

export interface RgbaImage {
	data: Uint8ClampedArray | Uint8Array;
	width: number;
	height: number;
}

/** A seat as a rotated rectangle: centre, size and angle (radians, within ±45°). */
export interface SeatBox {
	x: number;
	y: number;
	width: number;
	height: number;
	angle: number;
}

interface Component {
	label: number;
	area: number;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	touchesEdge: boolean;
}

export interface DetectOptions {
	/** A point inside one seat; other seats are matched against it. */
	example: { x: number; y: number };
	/** Pixels darker than this (0–255 luminance) count as lines and print. */
	inkThreshold?: number;
}

const INK = 1;

function inkMask(image: RgbaImage, threshold: number): Uint8Array {
	const { data, width, height } = image;
	const mask = new Uint8Array(width * height);
	for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
		const alpha = data[p + 3] / 255;
		// Transparent pixels count as white paper.
		const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) * alpha + 255 * (1 - alpha);
		if (lum < threshold) mask[i] = INK;
	}
	return mask;
}

/** Labels the connected light (non-ink) areas, 4-connected. Label 0 = ink. */
function labelAreas(mask: Uint8Array, width: number, height: number) {
	const labels = new Int32Array(width * height);
	const components: Component[] = [{ label: 0, area: 0, minX: 0, minY: 0, maxX: 0, maxY: 0, touchesEdge: true }];
	const stack = new Int32Array(width * height);
	for (let start = 0; start < labels.length; start++) {
		if (mask[start] === INK || labels[start] !== 0) continue;
		const label = components.length;
		const c: Component = { label, area: 0, minX: width, minY: height, maxX: 0, maxY: 0, touchesEdge: false };
		components.push(c);
		let top = 0;
		stack[top++] = start;
		labels[start] = label;
		while (top > 0) {
			const i = stack[--top];
			const x = i % width;
			const y = (i - x) / width;
			c.area++;
			if (x < c.minX) c.minX = x;
			if (x > c.maxX) c.maxX = x;
			if (y < c.minY) c.minY = y;
			if (y > c.maxY) c.maxY = y;
			if (x === 0 || y === 0 || x === width - 1 || y === height - 1) c.touchesEdge = true;
			if (x > 0 && mask[i - 1] !== INK && labels[i - 1] === 0) (labels[i - 1] = label), (stack[top++] = i - 1);
			if (x < width - 1 && mask[i + 1] !== INK && labels[i + 1] === 0) (labels[i + 1] = label), (stack[top++] = i + 1);
			if (y > 0 && mask[i - width] !== INK && labels[i - width] === 0) (labels[i - width] = label), (stack[top++] = i - width);
			if (y < height - 1 && mask[i + width] !== INK && labels[i + width] === 0) (labels[i + width] = label), (stack[top++] = i + width);
		}
	}
	return { labels, components };
}

type Point = [number, number];

function cross(o: Point, a: Point, b: Point) {
	return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Convex hull (Andrew's monotone chain). */
function convexHull(points: Point[]): Point[] {
	const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (pts.length < 3) return pts;
	const lower: Point[] = [];
	for (const p of pts) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
		lower.push(p);
	}
	const upper: Point[] = [];
	for (let i = pts.length - 1; i >= 0; i--) {
		const p = pts[i];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
		upper.push(p);
	}
	return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Smallest rectangle around the hull; one of its sides lies on a hull edge. */
function minAreaRect(hull: Point[]): SeatBox {
	let best: SeatBox & { area: number } = { x: 0, y: 0, width: 0, height: 0, angle: 0, area: Infinity };
	for (let i = 0; i < hull.length; i++) {
		const [x1, y1] = hull[i];
		const [x2, y2] = hull[(i + 1) % hull.length];
		const angle = Math.atan2(y2 - y1, x2 - x1);
		const ux = Math.cos(angle);
		const uy = Math.sin(angle);
		let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
		for (const [px, py] of hull) {
			const u = px * ux + py * uy;
			const v = -px * uy + py * ux;
			if (u < minU) minU = u;
			if (u > maxU) maxU = u;
			if (v < minV) minV = v;
			if (v > maxV) maxV = v;
		}
		const area = (maxU - minU) * (maxV - minV);
		if (area < best.area) {
			const cu = (minU + maxU) / 2;
			const cv = (minV + maxV) / 2;
			best = { x: cu * ux - cv * uy, y: cu * uy + cv * ux, width: maxU - minU, height: maxV - minV, angle, area };
		}
	}
	return normalizeBox(best);
}

/** Same rectangle with its angle within ±45° (swapping width and height when turning by 90°). */
export function normalizeBox(box: SeatBox): SeatBox {
	let { width, height, angle } = box;
	angle = Math.atan2(Math.sin(angle), Math.cos(angle)); // −π … π
	while (angle > Math.PI / 4) {
		angle -= Math.PI / 2;
		[width, height] = [height, width];
	}
	while (angle <= -Math.PI / 4) {
		angle += Math.PI / 2;
		[width, height] = [height, width];
	}
	return { x: box.x, y: box.y, width, height, angle };
}

/**
 * Pixel corners on the outline of one component, scanned row by row within its bounding box,
 * and its area with holes filled (printed digits inside a box count as part of the box).
 */
function outline(labels: Int32Array, width: number, c: Component): { points: Point[]; filledArea: number } {
	const points: Point[] = [];
	let filledArea = 0;
	for (let y = c.minY; y <= c.maxY; y++) {
		let first = -1;
		let last = -1;
		for (let x = c.minX; x <= c.maxX; x++) {
			if (labels[y * width + x] === c.label) {
				if (first < 0) first = x;
				last = x;
			}
		}
		if (first >= 0) {
			points.push([first, y], [first, y + 1], [last + 1, y], [last + 1, y + 1]);
			filledArea += last - first + 1;
		}
	}
	return { points, filledArea };
}

/** The component's rotated rectangle and how completely the (hole-filled) area covers it. */
function measure(labels: Int32Array, width: number, c: Component) {
	const { points, filledArea } = outline(labels, width, c);
	const box = minAreaRect(convexHull(points));
	return { box, fill: filledArea / (box.width * box.height) };
}

/**
 * The enclosed area the user clicked. Clicks usually land on the printed number, so this looks
 * around the point and takes the largest enclosed area nearby (not a hole inside a digit).
 */
function exampleComponent(labels: Int32Array, components: Component[], width: number, height: number, point: { x: number; y: number }) {
	const radius = 15;
	let best: Component | null = null;
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			const x = Math.round(point.x) + dx;
			const y = Math.round(point.y) + dy;
			if (x < 0 || y < 0 || x >= width || y >= height || dx * dx + dy * dy > radius * radius) continue;
			const c = components[labels[y * width + x]];
			if (c.label === 0 || c.touchesEdge) continue;
			// Ignore areas that extend far beyond the click, e.g. the space around the seats.
			if (c.maxX - c.minX > width / 3 || c.maxY - c.minY > height / 3) continue;
			if (!best || c.area > best.area) best = c;
		}
	}
	return best;
}

/**
 * Seat boxes similar to the one at `example`, in image pixel coordinates.
 * Returns an empty list when the example point is not inside an enclosed light area.
 */
export function detectSeatBoxes(image: RgbaImage, options: DetectOptions): SeatBox[] {
	const { width, height } = image;
	const mask = inkMask(image, options.inkThreshold ?? 128);
	const { labels, components } = labelAreas(mask, width, height);

	const ref = exampleComponent(labels, components, width, height, options.example);
	if (!ref) return [];
	const { box: refBox } = measure(labels, width, ref);
	const refLong = Math.max(refBox.width, refBox.height);
	const refShort = Math.min(refBox.width, refBox.height);

	const boxes: SeatBox[] = [];
	for (const c of components) {
		if (c.label === 0 || c.touchesEdge) continue;
		// Printed digits reduce the light area by up to a third.
		if (c.area < ref.area * 0.5 || c.area > ref.area * 1.6) continue;
		// Cheap rejection before computing the hull: the bounding box can't be much larger than a rotated seat.
		const diagonal = Math.hypot(refLong, refShort) * 1.3;
		if (c.maxX - c.minX > diagonal || c.maxY - c.minY > diagonal) continue;

		const { box, fill } = measure(labels, width, c);
		const long = Math.max(box.width, box.height);
		const short = Math.min(box.width, box.height);
		if (long < refLong * 0.75 || long > refLong * 1.3 || short < refShort * 0.75 || short > refShort * 1.3) continue;
		// Rectangles fill their bounding rectangle almost completely; blobs and L-shapes don't.
		if (fill < 0.85) continue;
		boxes.push(box);
	}
	return boxes;
}
