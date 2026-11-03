// Amounts are integers in minor units (Rappen/cents); CHF and EUR both have two decimals.

const AMOUNT = /^(\d{1,7})(?:[.,](\d{1,2}))?$/;

/** "45", "45.5", "45,50", "1'200.00", "1 200" → minor units, or null if it isn't an amount. */
export function parseMoney(value: string): number | null {
	const normalized = value.trim().replace(/['’\s]/g, '');
	const match = AMOUNT.exec(normalized);
	if (!match) return null;
	return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** Minor units → "45.50", the form `parseMoney` accepts back. */
export function toMoneyInput(minor: number): string {
	return (minor / 100).toFixed(2);
}

// The UI only knows the language ("de"); prices should still look like they do where the currency is used.
const CURRENCY_REGION: Record<string, string> = { CHF: 'CH' };

/** 4550 CHF in "de" → "CHF 45.50" (Swiss format), 4550 EUR in "de" → "45,50 €". */
export function formatMoney(minor: number, currency: string, locale: string): string {
	const region = CURRENCY_REGION[currency];
	const language = locale.split('-')[0];
	return new Intl.NumberFormat(region ? `${language}-${region}` : locale, { style: 'currency', currency }).format(minor / 100);
}
