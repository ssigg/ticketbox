import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
	it.each([
		['Theater am Hechtplatz – Zürich', 'theater-am-hechtplatz-zuerich'],
		['  Café Crème  ', 'cafe-creme'],
		['Straße 42!!', 'strasse-42'],
		['---', '']
	])('%s → %s', (input, expected) => expect(slugify(input)).toBe(expected));
});
