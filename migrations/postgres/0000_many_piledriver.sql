CREATE TABLE "booking_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"expires_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"business_id" text PRIMARY KEY NOT NULL,
	"data" text DEFAULT '{}' NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"services" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_operations" (
	"event_id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"data" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text NOT NULL,
	"client" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"time" text DEFAULT '' NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'lead' NOT NULL,
	"lifecycle" text DEFAULT 'Active' NOT NULL,
	"items" text NOT NULL,
	"total" integer NOT NULL,
	"deposit" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"follow_up" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_images" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"package_id" text NOT NULL,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"service" text NOT NULL,
	"price" integer NOT NULL,
	"duration" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"settings" text DEFAULT '{}' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"event_id" text NOT NULL,
	"amount" integer NOT NULL,
	"tip" integer DEFAULT 0 NOT NULL,
	"method" text NOT NULL,
	"date" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"data" text NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_records" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" text NOT NULL,
	"data" text NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_operations" ADD CONSTRAINT "event_operations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_operations" ADD CONSTRAINT "event_operations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_images" ADD CONSTRAINT "package_images_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_images" ADD CONSTRAINT "package_images_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_booking_rate_expiry" ON "booking_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_business_owner" ON "businesses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_operations_business" ON "event_operations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_events_business_status" ON "events" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "idx_package_images_owner" ON "package_images" USING btree ("business_id","package_id");--> statement-breakpoint
CREATE INDEX "idx_packages_business" ON "packages" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "idx_payments_business_event" ON "payments" USING btree ("business_id","event_id");--> statement-breakpoint
CREATE INDEX "idx_resources_business_kind" ON "resources" USING btree ("business_id","kind");--> statement-breakpoint
CREATE INDEX "idx_sales_records_business_kind" ON "sales_records" USING btree ("business_id","kind");--> statement-breakpoint
CREATE INDEX "idx_auth_account_user" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_account_provider" ON "auth_account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_auth_session_user" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_verification_identifier" ON "auth_verification" USING btree ("identifier");