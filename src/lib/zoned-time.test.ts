import { describe, expect, it } from 'vitest';
import { formatDateTime, fromLocalInput, toLocalInput } from './zoned-time';

const ZH = 'Europe/Zurich';

describe('fromLocalInput', () => {
	it('uses winter and summer offsets', () => {
		expect(fromLocalInput('2026-12-24T19:30', ZH)?.toISOString()).toBe('2026-12-24T18:30:00.000Z');
		expect(fromLocalInput('2026-07-01T20:00', ZH)?.toISOString()).toBe('2026-07-01T18:00:00.000Z');
	});

	it('handles the days DST changes', () => {
		// 2026-03-29 02:00 → 03:00 and 2026-10-25 03:00 → 02:00 in Zurich
		expect(fromLocalInput('2026-03-29T12:00', ZH)?.toISOString()).toBe('2026-03-29T10:00:00.000Z');
		expect(fromLocalInput('2026-10-25T12:00', ZH)?.toISOString()).toBe('2026-10-25T11:00:00.000Z');
	});

	it('works in other zones', () => {
		expect(fromLocalInput('2026-12-24T19:30', 'America/New_York')?.toISOString()).toBe('2026-12-25T00:30:00.000Z');
	});

	it.each(['', '2026-12-24', '2026-12-24 19:30', '2026-02-31T10:00', 'nonsense'])('rejects %j', (value) => {
		expect(fromLocalInput(value, ZH)).toBeNull();
	});
});

describe('toLocalInput', () => {
	it('round-trips', () => {
		for (const value of ['2026-12-24T19:30', '2026-07-01T00:05', '2026-03-29T12:00', '2027-01-01T00:00']) {
			expect(toLocalInput(fromLocalInput(value, ZH)!, ZH)).toBe(value);
		}
	});
});

describe('formatDateTime', () => {
	it('formats in the zone and locale', () => {
		const date = new Date('2026-12-24T18:30:00Z');
		expect(formatDateTime(date, ZH, 'de-CH')).toBe('24.12.2026, 19:30');
		expect(formatDateTime(date, ZH, 'en')).toBe('Dec 24, 2026, 7:30 PM');
	});
});
