import {
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};

export const tenants = pgTable('tenants', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	defaultLocale: text('default_locale').notNull().default('de'),
	currency: text('currency').notNull().default('CHF'),
	// IANA zone; event times are entered and shown in it.
	timezone: text('timezone').notNull().default('Europe/Zurich'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ── Better Auth tables (https://www.better-auth.com/docs/concepts/database#core-schema) ──

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	// Platform operators can manage all tenants. Registered as a Better Auth additional field.
	isSuperadmin: boolean('is_superadmin').notNull().default(false),
	...timestamps
});

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	token: text('token').notNull().unique(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	...timestamps
});

export const accounts = pgTable('accounts', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	password: text('password'),
	...timestamps
});

export const verifications = pgTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	...timestamps
});

export const rateLimits = pgTable('rate_limits', {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull()
});

// ── Tenant access ──

export const roleEnum = pgEnum('membership_role', ['owner', 'admin', 'boxoffice']);

export const memberships = pgTable(
	'memberships',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		role: roleEnum('role').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.tenantId] })]
);

// ── Events ──

/** Text per locale, e.g. { de: 'Konzert', en: 'Concert' }. */
export type LocalizedText = Partial<Record<string, string>>;

export const eventStatusEnum = pgEnum('event_status', ['draft', 'onsale', 'closed']);

export const events = pgTable(
	'events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		// Used in the public shop URL, unique per organizer.
		slug: text('slug').notNull(),
		name: jsonb('name').$type<LocalizedText>().notNull(),
		description: jsonb('description').$type<LocalizedText>().notNull().default({}),
		venue: text('venue').notNull().default(''),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		// Null means: from publishing / until the event starts.
		salesStart: timestamp('sales_start', { withTimezone: true }),
		salesEnd: timestamp('sales_end', { withTimezone: true }),
		status: eventStatusEnum('status').notNull().default('draft'),
		...timestamps
	},
	(t) => [unique().on(t.tenantId, t.slug), index().on(t.tenantId, t.startsAt)]
);

export type Event = typeof events.$inferSelect;

/** Price levels of an event; seats are assigned to them later in the seat plan. */
export const categories = pgTable(
	'categories',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		name: jsonb('name').$type<LocalizedText>().notNull(),
		// In minor units (Rappen/cents) of the organizer's currency.
		price: integer('price').notNull(),
		// Hex colour used for the category's seats in the seat plan.
		color: text('color').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps
	},
	(t) => [index().on(t.eventId), check('categories_price_not_negative', sql`${t.price} >= 0`)]
);

export type Category = typeof categories.$inferSelect;
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
