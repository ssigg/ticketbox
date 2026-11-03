// Row groups and problems for the seat plan editor's review, computed from the seats alone.

import { duplicateLabels, suggestNumber, type PlanSeat } from '../seat-plan';
import { detectRows } from './rows';

export interface RowGroup {
	/** The row name, or null for seats not named yet (grouped by detection). */
	name: string | null;
	section: string;
	/** Seat indices in reading order, per segment. */
	segments: number[][];
}

/** Named rows by their name, the remaining seats by detected rows. */
export function rowGroups(seats: PlanSeat[]): RowGroup[] {
	const groups: RowGroup[] = [];
	const ordered = (indices: number[]) =>
		detectRows(indices.map((i) => seats[i])).flatMap((row) => row.segments.map((segment) => segment.map((k) => indices[k])));

	const named = new Map<string, number[]>();
	const unnamed: number[] = [];
	seats.forEach((seat, i) => {
		if (!seat.row.trim()) unnamed.push(i);
		else {
			const key = JSON.stringify([seat.section.trim(), seat.row.trim()]);
			named.set(key, [...(named.get(key) ?? []), i]);
		}
	});
	for (const [key, indices] of named) {
		const [section, name] = JSON.parse(key) as [string, string];
		groups.push({ name, section, segments: ordered(indices) });
	}
	for (const row of detectRows(unnamed.map((i) => seats[i]))) {
		groups.push({ name: null, section: '', segments: row.segments.map((segment) => segment.map((k) => unnamed[k])) });
	}
	return groups;
}

export type ProblemKind = 'missing_number' | 'duplicate' | 'uncertain' | 'sequence';

export interface Problem {
	seat: number;
	kind: ProblemKind;
	/** A better number, derived from the neighbours in the row. */
	suggestion: string | null;
}

/** At a row's end: after 88, 89 comes 90; before 12, 13 comes 11. */
function continueSequence(nearer: string | undefined, farther: string | undefined): string | null {
	const a = Number(nearer);
	const b = Number(farther);
	if (!nearer || !farther || !Number.isInteger(a) || !Number.isInteger(b) || Math.abs(a - b) !== 1) return null;
	const next = a + (a - b);
	return next > 0 ? String(next) : null;
}

/**
 * Seats to look at, in row order. `uncertain` are seats whose number reading was doubtful.
 * A seat "breaks the sequence" when both neighbours say otherwise (…, 89, 30, 91, …).
 */
export function findProblems(seats: PlanSeat[], groups: RowGroup[], uncertain: Set<number>): Problem[] {
	const duplicates = new Set(duplicateLabels(seats));
	const problems: Problem[] = [];
	for (const group of groups) {
		const order = group.segments.flat();
		order.forEach((seat, k) => {
			const number = seats[seat].number.trim();
			const neighbours = suggestNumber(seats[order[k - 1]]?.number, seats[order[k + 1]]?.number);
			// One-sided guesses only for seats that are flagged anyway; rows may jump at their ends.
			const flagged = !number || duplicates.has(seat) || uncertain.has(seat);
			const suggestion =
				neighbours ??
				(flagged
					? (continueSequence(seats[order[k - 1]]?.number, seats[order[k - 2]]?.number) ??
						continueSequence(seats[order[k + 1]]?.number, seats[order[k + 2]]?.number))
					: null);
			const better = suggestion !== null && suggestion !== number ? suggestion : null;
			const kind: ProblemKind | null = !number
				? 'missing_number'
				: duplicates.has(seat)
					? 'duplicate'
					: neighbours !== null && neighbours !== number
						? 'sequence'
						: uncertain.has(seat)
							? 'uncertain'
							: null;
			if (kind) problems.push({ seat, kind, suggestion: better });
		});
	}
	return problems;
}

/** Numbers missing from an otherwise numeric 1…n style numbering, e.g. [150]. Empty if not numeric. */
export function missingNumbers(seats: PlanSeat[], limit = 50): number[] {
	const numbers = seats.map((s) => Number(s.number)).filter((n) => Number.isInteger(n) && n > 0);
	if (numbers.length < seats.length * 0.9 || numbers.length < 2) return [];
	const present = new Set(numbers);
	const max = Math.max(...numbers);
	if (max - Math.min(...numbers) > 10000) return [];
	const missing: number[] = [];
	for (let n = Math.min(...numbers); n <= max && missing.length < limit; n++) if (!present.has(n)) missing.push(n);
	return missing;
}
