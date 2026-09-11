# EventDesk public-launch migration

CRM for independent event businesses: leads, proposals, bookings, packages,
add-ons, backdrops, questionnaires, checklists, designs, scheduling, offline
payments and reports. Public booking submissions remain requests for approval.

This isolated branch migrates the existing beta to **GitHub + Railway + Neon
Postgres + Better Auth + Wasabi S3 + Cloudflare DNS/SSL**. The live Sites beta
has not been replaced. **Public launch is currently NO-GO: 61/100 readiness.**

## Start with these documents

- [Initial audit and changes required](docs/public-launch-audit.md)
- [Readiness and remaining launch gates](docs/readiness.md)
- [Architecture diagram and boundaries](docs/architecture.md)
- [Provider setup and secrets](docs/deployment-setup.md)
- [QA findings, reproductions and regression coverage](docs/qa-report.md)
- [Deployment, backups, restoration and rollback runbooks](docs/runbooks.md)

## Local development

Use Node 22 and npm. Copy `.env.example` to an ignored environment file and
configure a dedicated test database. Credentials must never be committed.

```sh
npm ci
node --env-file=.env.staging.local --import tsx scripts/migrate.ts
node --env-file=.env.staging.local --import tsx scripts/seed.ts
npm run build
node --env-file=.env.staging.local dist/standalone/server.js
```

Migrations require DIRECT_DATABASE_URL (owner). Runtime uses the restricted pooled
DATABASE_URL. Seeding requires APP_ENV=development/staging,
SEED_SYNTHETIC_DATA=true and a private SEED_PASSWORD; production seeding is refused.
The seed contains two synthetic owners/businesses, not imported customer records.

For isolated storage QA, run `node tests/fixtures/s3-server.mjs` and use the
loopback fixture settings shown in `.github/workflows/ci.yml`. The fixture is
not a real Wasabi connection. Staging/production runtime startup requires real
HTTPS storage and SMTP configuration. `npm run dev` starts a framework preview;
verify proxy/origin/body/security behavior using the built standalone server.

## Validation

```sh
npm run typecheck
npm run test:unit
npm run build
node --env-file=.env.staging.local --import tsx --test tests/platform/*.test.ts
node --env-file=.env.staging.local scripts/qa-workflows.mjs management public-booking sales
node --env-file=.env.staging.local node_modules/@playwright/test/cli.js test
```

API/browser tests require the synthetic seed, running standalone server and local
S3 fixture. Tests are not safe for customer databases. The CI workflow lists the
maintained migrated workflow suite. Some old SQLite-specific harnesses remain
historical and are explicitly excluded in the QA report. Passing a UI render
check does not prove every interaction or external integration works.

## Portable Docker runtime

```sh
docker build --target runtime -t eventdesk:local .
docker run --rm --env-file .env.staging.local -p 3100:3100 eventdesk:local
```

Use environment values reachable from inside the container; `localhost` there
means the container itself. The runtime image runs as a non-root user. A separate
`migrate` target contains the migration tools. Docker configuration exists but
no Docker daemon was available in this workstation session, so its build/run is
still a release gate. CI is prepared to build it.

## Current boundaries

Owner login uses verified Better Auth sessions; no ChatGPT account is required by
this migration code. Staff roster records are not login memberships. Tenant and
object authorization stays server-side. Public proposal links are revocable,
scoped bearer links. Quote money remains integer cents with historical snapshots.

The S3 adapter is implemented and tested with synthetic objects; real uploads
have not moved to Wasabi. CRM message delivery, online payment processing,
subscriptions and electronic signatures remain separate integrations. Real
account-verification/recovery email requires SMTP setup and testing.

The old beta README and hosting marker are retained under `docs/legacy/` as
historical references. Root comparison documents describe prior beta work;
they do not establish complete Check Cherry parity or current launch readiness.
