import { pgTable, text, boolean, timestamp, index, uniqueIndex, integer, bigint } from 'drizzle-orm/pg-core';
export const user = pgTable('auth_user', {
  id:text('id').primaryKey(), name:text('name').notNull(), email:text('email').notNull().unique(),
  emailVerified:boolean('email_verified').notNull().default(false), image:text('image'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const session = pgTable('auth_session', {
  id:text('id').primaryKey(), token:text('token').notNull().unique(),
  userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
  ipAddress:text('ip_address'), userAgent:text('user_agent'),
},t=>[index('idx_auth_session_user').on(t.userId)]);
export const account = pgTable('auth_account', {
  id:text('id').primaryKey(), accountId:text('account_id').notNull(), providerId:text('provider_id').notNull(),
  userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  accessToken:text('access_token'), refreshToken:text('refresh_token'), idToken:text('id_token'),
  accessTokenExpiresAt:timestamp('access_token_expires_at',{withTimezone:true}),
  refreshTokenExpiresAt:timestamp('refresh_token_expires_at',{withTimezone:true}),
  scope:text('scope'), password:text('password'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[index('idx_auth_account_user').on(t.userId),uniqueIndex('idx_auth_account_provider').on(t.providerId,t.accountId)]);
export const verification = pgTable('auth_verification', {
  id:text('id').primaryKey(), identifier:text('identifier').notNull(), value:text('value').notNull(),
  expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[index('idx_auth_verification_identifier').on(t.identifier)]);
export const rateLimit = pgTable('auth_rate_limit', {
  id:text('id').primaryKey(), key:text('key').notNull().unique(), count:integer('count').notNull(),
  lastRequest:bigint('last_request',{mode:'number'}).notNull(),
});
