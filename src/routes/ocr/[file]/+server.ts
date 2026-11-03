import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Tesseract's worker, WebAssembly core and English model, served from our own installation
// instead of a CDN (works offline, no third party involved). Paths are relative to the app's
// working directory, where node_modules lives in development and production.
const CORE = 'node_modules/tesseract.js-core';
const FILES: Record<string, string> = {
	'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
	'eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'
};
const TYPES: Record<string, string> = { js: 'text/javascript', wasm: 'application/wasm', gz: 'application/gzip' };

export const GET: RequestHandler = async ({ params }) => {
	const name = params.file;
	const path = FILES[name] ?? (/^tesseract-core[\w-]*\.wasm(\.js)?$/.test(name) ? `${CORE}/${name}` : null);
	if (!path) error(404);
	let body: Buffer;
	try {
		body = await readFile(join(process.cwd(), path));
	} catch {
		error(404);
	}
	return new Response(new Uint8Array(body), {
		headers: {
			'content-type': TYPES[name.split('.').pop()!] ?? 'application/octet-stream',
			'cache-control': 'public, max-age=86400'
		}
	});
};
