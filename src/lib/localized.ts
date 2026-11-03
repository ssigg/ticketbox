/** The text in `locale`, else in `fallback`, else in any language that has one. */
export function localized(text: Partial<Record<string, string>>, locale: string, fallback: string): string {
	return text[locale] || text[fallback] || Object.values(text).find(Boolean) || '';
}
