import { and, asc, eq, inArray, max } from 'drizzle-orm';
import { db } from './db';
import {
	categories,
	reductionCategories,
	reductionKindEnum,
	reductions,
	type LocalizedText,
	type Reduction,
	type Tenant
} from './db/schema';
import { ownedEventId } from './events';
import { parseMoney, toMoneyInput } from '../money';
import { locales } from '../paraglide/runtime.js';

export type ReductionWithCategories = Reduction & { categoryIds: string[] };
/** Text fields by name, plus `categoryIds` from the checkboxes. */
export type ReductionFormValues = Record<string, string | string[] | undefined>;
export type ReductionFormErrors = Partial<Record<string, true>>;
type ReductionInput = Pick<Reduction, 'name' | 'kind' | 'value' | 'allCategories'> & { categoryIds: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `value` is "20" / "12.5" for percentages and "5" / "5.50" for amounts; both have two decimals,
 * so parseMoney yields basis points and minor units respectively.
 * `eventCategoryIds` are the event's categories; a restriction may only name those.
 */
export function parseReductionForm(values: ReductionFormValues, defaultLocale: string, eventCategoryIds: string[]):
	| { ok: true; input: ReductionInput }
	| { ok: false; errors: ReductionFormErrors } {
	const errors: ReductionFormErrors = {};
	const str = (key: string) => {
		const value = values[key];
		return typeof value === 'string' ? value : '';
	};
	const name: LocalizedText = {};
	for (const locale of locales) {
		const text = str(`name.${locale}`).trim();
		if (text) name[locale] = text;
		if (text.length > 100) errors[`name.${locale}`] = true;
	}
	if (!name[defaultLocale]) errors[`name.${defaultLocale}`] = true;

	const kind = (reductionKindEnum.enumValues as readonly string[]).includes(str('kind')) ? (str('kind') as Reduction['kind']) : null;
	if (!kind) errors.kind = true;

	const value = parseMoney(str('value'));
	if (value === null || value <= 0 || (kind === 'percent' && value > 10000)) errors.value = true;

	const allCategories = str('scope') !== 'selected';
	const selected = Array.isArray(values.categoryIds) ? values.categoryIds : [];
	const categoryIds = allCategories ? [] : [...new Set(selected)];
	if (!allCategories && (categoryIds.length === 0 || categoryIds.some((id) => !eventCategoryIds.includes(id)))) {
		errors.categoryIds = true;
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, input: { name, kind: kind!, value: value!, allCategories, categoryIds } };
}

export function reductionToForm(reduction: ReductionWithCategories): ReductionFormValues {
	const values: ReductionFormValues = {
		kind: reduction.kind,
		value: reduction.kind === 'percent' ? String(reduction.value / 100) : toMoneyInput(reduction.value),
		scope: reduction.allCategories ? 'all' : 'selected',
		categoryIds: reduction.categoryIds
	};
	for (const locale of locales) values[`name.${locale}`] = reduction.name[locale] ?? '';
	return values;
}

async function eventCategoryIds(eventId: string): Promise<string[]> {
	const rows = await db.select({ id: categories.id }).from(categories).where(eq(categories.eventId, eventId));
	return rows.map((row) => row.id);
}

export async function listReductions(tenantId: string, eventId: string): Promise<ReductionWithCategories[]> {
	const id = await ownedEventId(tenantId, eventId);
	if (!id) return [];
	const rows = await db
		.select()
		.from(reductions)
		.where(eq(reductions.eventId, id))
		.orderBy(asc(reductions.sortOrder), asc(reductions.createdAt));
	const links = rows.length
		? await db.select().from(reductionCategories).where(inArray(reductionCategories.reductionId, rows.map((r) => r.id)))
		: [];
	return rows.map((row) => ({
		...row,
		categoryIds: links.filter((link) => link.reductionId === row.id).map((link) => link.categoryId)
	}));
}

export type SaveReductionResult = { ok: true; reduction: Reduction } | { ok: false; errors: ReductionFormErrors } | null;

export async function saveReduction(
	tenant: Pick<Tenant, 'id' | 'defaultLocale'>,
	eventId: string,
	/** Absent to create a new reduction. */
	reductionId: string | undefined,
	values: ReductionFormValues
): Promise<SaveReductionResult> {
	const id = await ownedEventId(tenant.id, eventId);
	if (!id || (reductionId !== undefined && !UUID.test(reductionId))) return null;
	const parsed = parseReductionForm(values, tenant.defaultLocale, await eventCategoryIds(id));
	if (!parsed.ok) return parsed;
	const { categoryIds, ...fields } = parsed.input;

	return db.transaction(async (tx) => {
		let reduction: Reduction | undefined;
		if (reductionId) {
			[reduction] = await tx
				.update(reductions)
				.set(fields)
				.where(and(eq(reductions.id, reductionId), eq(reductions.eventId, id)))
				.returning();
			if (!reduction) return null;
			await tx.delete(reductionCategories).where(eq(reductionCategories.reductionId, reduction.id));
		} else {
			const [{ last }] = await tx.select({ last: max(reductions.sortOrder) }).from(reductions).where(eq(reductions.eventId, id));
			[reduction] = await tx
				.insert(reductions)
				.values({ ...fields, eventId: id, sortOrder: (last ?? -1) + 1 })
				.returning();
		}
		if (categoryIds.length) {
			await tx.insert(reductionCategories).values(categoryIds.map((categoryId) => ({ reductionId: reduction!.id, categoryId })));
		}
		return { ok: true as const, reduction };
	});
}

export async function deleteReduction(tenantId: string, eventId: string, reductionId: string): Promise<Reduction | null> {
	const id = await ownedEventId(tenantId, eventId);
	if (!id || !UUID.test(reductionId)) return null;
	const [deleted] = await db
		.delete(reductions)
		.where(and(eq(reductions.id, reductionId), eq(reductions.eventId, id)))
		.returning();
	return deleted ?? null;
}

export async function moveReduction(tenantId: string, eventId: string, reductionId: string, direction: -1 | 1): Promise<boolean> {
	const list = await listReductions(tenantId, eventId);
	const index = list.findIndex((r) => r.id === reductionId);
	const target = index + direction;
	if (index < 0 || target < 0 || target >= list.length) return false;
	[list[index], list[target]] = [list[target], list[index]];
	await db.transaction(async (tx) => {
		for (const [sortOrder, reduction] of list.entries()) {
			await tx.update(reductions).set({ sortOrder }).where(eq(reductions.id, reduction.id));
		}
	});
	return true;
}

