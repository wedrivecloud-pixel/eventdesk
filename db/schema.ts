import {
  pgTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
export * from './auth-schema';
export const businesses = pgTable(
  'businesses',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull().default(''),
    services: text('services').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('idx_business_owner').on(t.ownerId)],
);
export const packages = pgTable(
  'packages',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    service: text('service').notNull(),
    price: integer('price').notNull(),
    duration: text('duration').notNull(),
    description: text('description').notNull().default(''),
    settings: text('settings').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_packages_business').on(t.businessId)],
);
export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    title: text('title').notNull(),
    client: text('client').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull().default(''),
    date: text('date').notNull(),
    time: text('time').notNull().default(''),
    venue: text('venue').notNull().default(''),
    source: text('source').notNull().default(''),
    status: text('status').notNull().default('lead'),
    lifecycle: text('lifecycle').notNull().default('Active'),
    items: text('items').notNull(),
    total: integer('total').notNull(),
    deposit: integer('deposit').notNull().default(0),
    notes: text('notes').notNull().default(''),
    followUp: text('follow_up').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_events_business_status').on(t.businessId, t.status)],
);
export const businessSettings = pgTable('business_settings', {
  businessId: text('business_id')
    .primaryKey()
    .references(() => businesses.id),
  data: text('data').notNull().default('{}'),
  updatedAt: text('updated_at').notNull(),
});
export const resources = pgTable(
  'resources',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    data: text('data').notNull(),
    archived: integer('archived').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_resources_business_kind').on(t.businessId, t.kind)],
);
export const eventOperations = pgTable(
  'event_operations',
  {
    eventId: text('event_id')
      .primaryKey()
      .references(() => events.id),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    data: text('data').notNull().default('{}'),
  },
  (t) => [index('idx_operations_business').on(t.businessId)],
);
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    amount: integer('amount').notNull(),
    tip: integer('tip').notNull().default(0),
    method: text('method').notNull(),
    date: text('date').notNull(),
    reference: text('reference').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_payments_business_event').on(t.businessId, t.eventId)],
);

export const packageImages = pgTable(
  'package_images',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    packageId: text('package_id')
      .notNull()
      .references(() => packages.id),
    isPrimary: integer('is_primary').notNull().default(0),
    alt: text('alt').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_package_images_owner').on(t.businessId, t.packageId)],
);
export const bookingRateLimits = pgTable(
  'booking_rate_limits',
  {
    key: text('key').primaryKey(),
    hits: integer('hits').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('idx_booking_rate_expiry').on(t.expiresAt)],
);

export const salesRecords = pgTable(
  'sales_records',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    kind: text('kind').notNull(),
    data: text('data').notNull(),
    archived: integer('archived').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_sales_records_business_kind').on(t.businessId, t.kind)],
);
