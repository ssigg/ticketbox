import { error, fail, redirect } from '@sveltejs/kit';
import { createOrganizer } from '#lib/server/organizers.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions } from './$types';

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user?.isSuperadmin) error(403, m.forbidden());

		const form = await request.formData();
		const input = {
			name: String(form.get('name') ?? ''),
			slug: String(form.get('slug') ?? ''),
			defaultLocale: String(form.get('defaultLocale') ?? ''),
			currency: String(form.get('currency') ?? '')
		};
		const result = await createOrganizer(input as Parameters<typeof createOrganizer>[0]);
		if (!result.ok) return fail(400, { values: input, errors: result.errors });

		redirect(303, `/admin/organizers/${result.organizer.slug}`);
	}
};
