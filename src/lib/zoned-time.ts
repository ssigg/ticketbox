// Converts between instants and wall-clock time in an IANA time zone, using only Intl.
// Event times are entered as `datetime-local` values ("2026-12-24T19:30") meaning local time at the venue.

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function wallClock(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(date);
	const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
	return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** How far `timeZone` is ahead of UTC at instant `ms`, in milliseconds. */
function offsetAt(ms: number, timeZone: string): number {
	const w = wallClock(new Date(ms), timeZone);
	return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-12-24T19:30" in `timeZone` → instant, or null if the value is malformed. */
export function fromLocalInput(value: string, timeZone: string): Date | null {
	const match = LOCAL_INPUT.exec(value);
	if (!match) return null;
	const [year, month, day, hour, minute] = match.slice(1).map(Number);
	const asUtc = Date.UTC(year, month - 1, day, hour, minute);
	if (new Date(asUtc).getUTCDate() !== day) return null; // e.g. 2026-02-31
	// The offset depends on the instant we're looking for; a second pass settles DST transitions.
	const guess = asUtc - offsetAt(asUtc, timeZone);
	return new Date(asUtc - offsetAt(guess, timeZone));
}

/** Instant → "2026-12-24T19:30" in `timeZone`, for `datetime-local` inputs. */
export function toLocalInput(date: Date, timeZone: string): string {
	const w = wallClock(date, timeZone);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

export function formatDateTime(date: Date, timeZone: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}
