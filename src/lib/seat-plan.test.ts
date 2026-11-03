import { describe, expect, it } from 'vitest';
import { duplicateLabels, generateRow, nextNumber, renumber, seatsInRect } from './seat-plan';

describe('generateRow', () => {
	it('spaces seats evenly between both ends', () => {
		const row = generateRow({ x: 100, y: 50 }, { x: 400, y: 80 }, 4, { section: 'P', row: '3', firstNumber: 1, step: 1 });
		expect(row).toEqual([
			{ section: 'P', row: '3', number: '1', x: 100, y: 50 },
			{ section: 'P', row: '3', number: '2', x: 200, y: 60 },
			{ section: 'P', row: '3', number: '3', x: 300, y: 70 },
			{ section: 'P', row: '3', number: '4', x: 400, y: 80 }
		]);
	});

	it('supports odd/even numbering and a single seat', () => {
		expect(generateRow({ x: 0, y: 0 }, { x: 10, y: 0 }, 3, { section: '', row: 'A', firstNumber: 1, step: 2 }).map((s) => s.number)).toEqual(['1', '3', '5']);
		expect(generateRow({ x: 5, y: 6 }, { x: 10, y: 0 }, 1, { section: '', row: 'A', firstNumber: 7, step: 1 })).toEqual([
			{ section: '', row: 'A', number: '7', x: 5, y: 6 }
		]);
	});
});

describe('renumber', () => {
	const seats = [{ x: 30, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
	it('numbers in reading order', () => {
		expect(renumber(seats, 1, 1, 'ltr')).toEqual(['3', '1', '2']);
		expect(renumber(seats, 10, 2, 'rtl')).toEqual(['10', '14', '12']);
	});
});

describe('seatsInRect', () => {
	it('finds seats inside a rectangle drawn in any direction', () => {
		const seats = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 5, y: 15 }];
		expect(seatsInRect(seats, { x1: 0, y1: 0, x2: 10, y2: 20 })).toEqual([0, 2]);
		expect(seatsInRect(seats, { x1: 20, y1: 10, x2: 0, y2: 0 })).toEqual([0, 1]);
	});
});

describe('labels', () => {
	it('finds duplicates, ignoring surrounding spaces', () => {
		const seats = [
			{ section: '', row: 'A', number: '1' },
			{ section: '', row: 'A', number: '2' },
			{ section: '', row: 'A ', number: '1' },
			{ section: 'Balkon', row: 'A', number: '1' }
		];
		expect(duplicateLabels(seats)).toEqual([0, 2]);
	});

	it('suggests the next number of a row', () => {
		const seats = [{ section: '', row: 'A', number: '1' }, { section: '', row: 'A', number: '4' }, { section: '', row: 'B', number: '9' }];
		expect(nextNumber(seats, '', 'A')).toBe(5);
		expect(nextNumber(seats, '', 'C')).toBe(1);
	});
});
