import { describe, expect, it } from 'vitest';
import { appliesTo, reducedPrice } from './pricing';

describe('reducedPrice', () => {
	it('keeps the full price without a reduction', () => {
		expect(reducedPrice(4500, null, 'CHF')).toBe(4500);
	});

	it('subtracts absolute reductions, never below zero', () => {
		expect(reducedPrice(4500, { kind: 'absolute', value: 1000 }, 'CHF')).toBe(3500);
		expect(reducedPrice(800, { kind: 'absolute', value: 1000 }, 'CHF')).toBe(0);
	});

	it('rounds percentages to 5 Rappen for CHF', () => {
		expect(reducedPrice(4500, { kind: 'percent', value: 2000 }, 'CHF')).toBe(3600);
		// 33 % of 29.50 = 19.765 → 19.75
		expect(reducedPrice(2950, { kind: 'percent', value: 3300 }, 'CHF')).toBe(1975);
		// 12.5 % of 19.90 = 17.4125 → 17.40
		expect(reducedPrice(1990, { kind: 'percent', value: 1250 }, 'CHF')).toBe(1740);
	});

	it('rounds percentages to cents for other currencies', () => {
		expect(reducedPrice(2950, { kind: 'percent', value: 3300 }, 'EUR')).toBe(1977);
	});

	it('makes 100 % free', () => {
		expect(reducedPrice(4500, { kind: 'percent', value: 10000 }, 'CHF')).toBe(0);
	});
});

describe('appliesTo', () => {
	it('applies to all or only the selected categories', () => {
		expect(appliesTo({ allCategories: true, categoryIds: [] }, 'a')).toBe(true);
		expect(appliesTo({ allCategories: false, categoryIds: ['a'] }, 'a')).toBe(true);
		expect(appliesTo({ allCategories: false, categoryIds: ['a'] }, 'b')).toBe(false);
	});
});
