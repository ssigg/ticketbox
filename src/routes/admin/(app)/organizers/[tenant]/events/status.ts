import { m } from '#lib/paraglide/messages.js';

export const EVENT_STATUSES = ['draft', 'onsale', 'closed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const statusLabel: Record<EventStatus, () => string> = {
	draft: m.status_draft,
	onsale: m.status_onsale,
	closed: m.status_closed
};

export const statusDescription: Record<EventStatus, () => string> = {
	draft: m.status_draft_description,
	onsale: m.status_onsale_description,
	closed: m.status_closed_description
};

export const statusVariant: Record<EventStatus, 'outline' | 'default' | 'secondary'> = {
	draft: 'outline',
	onsale: 'default',
	closed: 'secondary'
};
