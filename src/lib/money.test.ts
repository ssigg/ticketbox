import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney, toMoneyInput } from './money';

describe('parseMoney', () => {
	it.each([
		['45', 4500],
		['45.5', 4550],
		['45,50', 4550],
		[' 0.05 ', 5],
		['0', 0],
		["1'200.00", 120000],
		['1 200', 120000]
	])('%j → %d', (input, expected) => expect(parseMoney(input)).toBe(expected));

	it.each(['', '-5', '4.555', 'abc', '12.', '.50', '1e3', '99999999'])('rejects %j', (input) => {
		expect(parseMoney(input)).toBeNull();
	});
});

describe('formatting', () => {
	it('round-trips through the input format', () => {
		for (const minor of [0, 5, 4550, 120000]) expect(parseMoney(toMoneyInput(minor))).toBe(minor);
	});

	it('formats in the locale', () => {
		// Intl separates currency and amount with a non-breaking space.
		const formatMoney_ = (...args: Parameters<typeof formatMoney>) => formatMoney(...args).replace(/\s/g, ' ');
		expect(formatMoney_(4550, 'CHF', 'de-CH')).toBe('CHF 45.50');
		expect(formatMoney_(4550, 'CHF', 'de')).toBe('CHF 45.50');
		expect(formatMoney_(4550, 'CHF', 'en')).toBe('CHF 45.50');
		expect(formatMoney_(4550, 'EUR', 'de')).toBe('45,50 €');
	});
});
