// Ticket prices: category price minus the chosen reduction. Shared by the admin preview and, later, checkout.

export type ReductionRule = { kind: 'percent' | 'absolute'; value: number };

/** Smallest amount that can be paid in cash, in minor units. */
const CASH_STEP: Record<string, number> = { CHF: 5 };

/**
 * `basePrice` in minor units minus the reduction, never below zero.
 * Percentages are rounded to the currency's cash step (CHF 0.05) so box office prices can be paid in coins.
 */
export function reducedPrice(basePrice: number, reduction: ReductionRule | null, currency: string): number {
	if (!reduction) return basePrice;
	if (reduction.kind === 'absolute') return Math.max(0, basePrice - reduction.value);
	const step = CASH_STEP[currency] ?? 1;
	const raw = (basePrice * (10000 - reduction.value)) / 10000;
	return Math.max(0, Math.round(raw / step) * step);
}

/** Whether a reduction can be chosen for a ticket in `categoryId`. */
export function appliesTo(reduction: { allCategories: boolean; categoryIds: string[] }, categoryId: string): boolean {
	return reduction.allCategories || reduction.categoryIds.includes(categoryId);
}
