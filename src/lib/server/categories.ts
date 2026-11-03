import { and, asc, eq, max } from 'drizzle-orm';
import { db } from './db';
import { categories, events, type Category, type LocalizedText, type Tenant } from './db/schema';
import { CATEGORY_COLORS } from '../category-colors';
import { parseMoney, toMoneyInput } from '../money';
import { locales } from '../paraglide/runtime.js';

export type CategoryFormValues = Record<string, string>;
export type CategoryFormErrors = Partial<Record<string, true>>;
type CategoryInput = Pick<Category, 'name' | 'price' | 'color'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Name per locale (required in the default locale), price as entered ("45.50"), colour from the palette. */
export function parseCategoryForm(values: CategoryFormValues, defaultLocale: string):
	| { ok: true; input: CategoryInput }
	| { ok: false; errors: CategoryFormErrors } {
	const errors: CategoryFormErrors = {};
	const name: LocalizedText = {};
	for (const locale of locales) {
		const text = (values[`name.${locale}`] ?? '').trim();
		if (text) name[locale] = text;
		if (text.length > 100) errors[`name.${locale}`] = true;
	}
	if (!name[defaultLocale]) errors[`name.${defaultLocale}`] = true;

	const price = parseMoney(values.price ?? '');
	if (price === null) errors.price = true;

	const color = values.color ?? '';
	if (!(CATEGORY_COLORS as readonly string[]).includes(color)) errors.color = true;

	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, input: { name, price: price!, color } };
}

export function categoryToForm(category: Category): CategoryFormValues {
	const values: CategoryFormValues = { price: toMoneyInput(category.price), color: category.color };
	for (const locale of locales) values[`name.${locale}`] = category.name[locale] ?? '';
	return values;
}

/** The event's id if it belongs to the organizer; every query below goes through this. */
async function ownedEventId(tenantId: string, eventId: string): Promise<string | null> {
	if (!UUID.test(eventId)) return null;
	const [event] = await db
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)));
	return event?.id ?? null;
}

export async function listCategories(tenantId: string, eventId: string): Promise<Category[]> {
	const id = await ownedEventId(tenantId, eventId);
	if (!id) return [];
	return db
		.select()
		.from(categories)
		.where(eq(categories.eventId, id))
		.orderBy(asc(categories.sortOrder), asc(categories.createdAt));
}

export type SaveCategoryResult = { ok: true; category: Category } | { ok: false; errors: CategoryFormErrors } | null;

export async function createCategory(
	tenant: Pick<Tenant, 'id' | 'defaultLocale'>,
	eventId: string,
	values: CategoryFormValues
): Promise<SaveCategoryResult> {
	const id = await ownedEventId(tenant.id, eventId);
	if (!id) return null;
	const parsed = parseCategoryForm(values, tenant.defaultLocale);
	if (!parsed.ok) return parsed;
	const [{ last }] = await db.select({ last: max(categories.sortOrder) }).from(categories).where(eq(categories.eventId, id));
	const [category] = await db
		.insert(categories)
		.values({ ...parsed.input, eventId: id, sortOrder: (last ?? -1) + 1 })
		.returning();
	return { ok: true, category };
}

export async function updateCategory(
	tenant: Pick<Tenant, 'id' | 'defaultLocale'>,
	eventId: string,
	categoryId: string,
	values: CategoryFormValues
): Promise<SaveCategoryResult> {
	const id = await ownedEventId(tenant.id, eventId);
	if (!id || !UUID.test(categoryId)) return null;
	const parsed = parseCategoryForm(values, tenant.defaultLocale);
	if (!parsed.ok) return parsed;
	const [category] = await db
		.update(categories)
		.set(parsed.input)
		.where(and(eq(categories.id, categoryId), eq(categories.eventId, id)))
		.returning();
	return category ? { ok: true, category } : null;
}

export async function deleteCategory(tenantId: string, eventId: string, categoryId: string): Promise<Category | null> {
	const id = await ownedEventId(tenantId, eventId);
	if (!id || !UUID.test(categoryId)) return null;
	const [deleted] = await db
		.delete(categories)
		.where(and(eq(categories.id, categoryId), eq(categories.eventId, id)))
		.returning();
	return deleted ?? null;
}

/** Moves a category one place up or down. */
export async function moveCategory(tenantId: string, eventId: string, categoryId: string, direction: -1 | 1): Promise<boolean> {
	const list = await listCategories(tenantId, eventId);
	const index = list.findIndex((c) => c.id === categoryId);
	const target = index + direction;
	if (index < 0 || target < 0 || target >= list.length) return false;
	[list[index], list[target]] = [list[target], list[index]];
	await db.transaction(async (tx) => {
		for (const [sortOrder, category] of list.entries()) {
			await tx.update(categories).set({ sortOrder }).where(eq(categories.id, category.id));
		}
	});
	return true;
}
