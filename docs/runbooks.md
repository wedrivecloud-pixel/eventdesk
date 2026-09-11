# Operations runbooks

## Local development and staging

Use Node 22, `npm ci`, a separate test database and ignored environment file.
Run `npm run db:generate` only after schema changes; review generated SQL. Apply
with `npm run db:migrate` using a direct owner URL. The runner holds a migration
advisory lock, checks immutable checksums and wraps each migration in a transaction.
Add a new migration rather than editing an applied file. PostgreSQL functions in
`migrations/functions.sql` are the immutable initial definitions; updates belong
in new numbered SQL migrations.

`npm run db:seed` requires APP_ENV=development/staging, SEED_SYNTHETIC_DATA=true and
a private SEED_PASSWORD. It seeds only synthetic QA accounts. Never seed QA users
into production. Production starts empty until the reviewed legacy import.
`scripts/provision-runtime-role.ts` creates a non-admin SQL login. Do not use the
Neon console/API default roles for app access: those may inherit neon_superuser.

## Deployment

1. Validate the commit: typecheck, unit, PostgreSQL/API, browser and Docker tests.
2. Verify the latest backup and restore-drill evidence.
3. Apply backward-compatible migrations with the owner credential.
4. Stamp and deploy the tested commit. Railway waits for `/api/health/ready`, which checks
   the migration table, database connectivity and Wasabi bucket access.
   Verify that its reported commit matches the intended release; a healthy older
   instance is not a successful deployment. `scripts/verify-release.mjs` enforces this.
5. Check login, scoped records, one upload/download and one booking request through
   the actual public domain. Inspect error rate/latency before calling it complete.

`/api/health/live` checks the process only; it is not evidence of database/storage
readiness. Keep production environment variables separate from staging.

## Backups and restoration

Use a separate private, versioned Wasabi backup bucket and separate least-privilege
backup credentials. Set BACKUP_BUCKET, BACKUP_ACCESS_KEY_ID, BACKUP_SECRET_ACCESS_KEY,
DIRECT_DATABASE_URL, APP_ENV and Wasabi endpoint/region. Run `node scripts/backup.mjs`.
PostgreSQL 17 `pg_dump` must be installed, or set BACKUP_USE_DOCKER=true. The script
uses environment credentials rather than password-bearing command arguments,
uploads a custom-format dump and verifies SHA-256 by reading the stored object.

Schedule daily backups and run one immediately before a migration/cutover. Target
RPO is 24 hours from dumps plus the configured Neon recovery window; verify actual
plan retention before promising a shorter RPO. Target RTO of two hours is unproven
until a timed restore drill succeeds. Retain daily backups 30 days and weekly
backups 12 weeks using reviewed lifecycle rules. Wasabi retention/billing settings
must be checked for the chosen account before enabling cleanup.

Restore to a newly created, empty database, never over the current production DB:
download the dump, check SHA-256 against its manifest, run `pg_restore --no-owner
--no-acl --exit-on-error`, provision a fresh restricted runtime role, and compare
table counts, critical totals and tenant isolation. Restore/check uploaded objects
using their versioned inventory. Run smoke tests with delivery disabled before
switching the application connection. Record start/end times and evidence.

## Existing data and file migration

Freeze writes in the old app during the final export. Export every D1 application
table, validate IDs/foreign keys/JSON, and record row counts and money totals.
Map existing owner IDs to verified Better Auth users through an operator-reviewed
mapping; never automatically claim a business by an unverified email address.
Keep the source export private and retain a read-only copy for rollback.

For objects, obtain read-only SOURCE_S3_* credentials for the actual R2 source.
Review source/target buckets, then run `scripts/migrate-objects.mjs` with
OBJECT_MIGRATION_ENABLED=true. It preserves key paths and content types, checks
SHA-256 on downloaded targets and does not remove source objects. Existing target
keys require review, avoiding silent overwrites. A failed run can leave verified
partial copies; reconcile the manifest before retrying.

## Rollback

Application-only failure: redeploy the last tested image/commit. Migrations must
remain backward compatible with that version. Do not automatically run down
migrations or drop columns. For data corruption: stop writes, restore to a new DB,
verify it, then switch the runtime URL. Preserve the failed DB for investigation.
For initial cutover failure: point users back to the retained beta only after
reconciling any records written on the new site; DNS rollback alone cannot merge data.

## Incident response and secret rotation

Use request IDs and JSON logs; never paste cookies, SMTP passwords, database URLs
or customer message bodies into tickets. Investigate 5xx errors, failed readiness,
rate-limit spikes and slow queries. Rotate an exposed credential at its provider,
update only the corresponding environment, restart, and revoke the old credential.
Restore drills, alerts and provider dashboard access must be verified before launch.
