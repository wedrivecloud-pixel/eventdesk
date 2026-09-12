# Deployment setup and secrets handoff

This document is a setup procedure. Items are not considered deployed until they
are verified in `readiness.md`. Never paste passwords, tokens or database URLs into
chat, issues, committed files or build logs.

## Environment separation

| Setting | Local QA | Staging | Production |
|---|---|---|---|
| Source | Migration branch | `dev` | `main` |
| APP_ENV | `development` | `staging` | `production` |
| Database | Synthetic Neon staging data | Separate staging project | Separate production project |
| Auth secret | Random local secret | Unique staging secret | Unique production secret |
| Uploads | Loopback fixture | Private staging bucket | Private production bucket |
| Sender | Not connected | Verified test sender/recipient policy | Verified production sender |
| Public domain | localhost | User-selected staging hostname | User-selected production hostname |

Do not point developer/CI test scripts at a populated business environment. Synthetic
reset scripts require exactly the two QA businesses; seed refuses production.

## GitHub

Create or select the user-approved repository, then replace the migration clone's
local `origin` with that GitHub repository. Do not modify the separate beta checkout.
Push the reviewed branch, create `dev` and `main`, and use pull requests to promote
`dev` changes to `main`. Preserve the baseline tag/commit for recovery.

Enable branch protection: require the `checks` job from Validate, reviewed pull
requests, resolved conversations and no force pushes/deletion. Protect workflow
changes through CODEOWNERS once the maintainer/team is confirmed. Configure the
GitHub environments `staging` and `production` with deployment branch restrictions.
Dependencies are locked and third-party Actions use immutable commit hashes.

Set these per GitHub environment:

| Name | Kind | Purpose |
|---|---|---|
| DIRECT_DATABASE_URL | Secret | Direct TLS-verified owner connection for migration and backup, not the web app |
| RAILWAY_TOKEN | Secret | Environment/project-scoped Railway deploy token |
| BACKUP_ACCESS_KEY_ID / BACKUP_SECRET_ACCESS_KEY | Secrets | Separate private backup writer/reader |
| RAILWAY_SERVICE_ID / RAILWAY_ENVIRONMENT_ID | Variables | Actual target IDs from Railway |
| RAILWAY_PROJECT_ID | Variable | Explicit Railway project target; never infer/create a project during CI |
| APP_URL | Variable | Exact HTTPS origin |
| WASABI_ENDPOINT / WASABI_REGION | Variables | Verified bucket endpoint/region |
| BACKUP_BUCKET | Variable | Environment backup bucket |
| DEPLOY_ENABLED | Variable | `true` only once all corresponding resources are configured |

Validate runs on pull requests and pushes to `dev`/`main`. Deploy runs only after a
successful push validation from the same repository and deploys the tested SHA.
It verifies a backup, applies migrations, stamps the tested SHA, deploys and checks
that public readiness reports that exact SHA. An older healthy instance cannot
make the release job pass. Manual deployments must stamp `server/release.json`
with `node scripts/write-release.mjs <tested-40-character-SHA>` before building.
Disable independent Railway Git autodeploy so it cannot bypass or race these gates.
The scheduled backup workflow runs from the default branch; verify its first run
and configure GitHub workflow failure notifications for the responsible operator.

## Railway runtime

Create isolated staging and production environments/services. Use the repository
Dockerfile. The new-service UI no longer permits opting into legacy Config as Code;
do not rely on `railway.json` being applied. Configure equivalent builder, health
probe, timeout and restart policy in Railway or its supported Infrastructure as
Code, then verify the effective values. See `github-handoff.md` for actual IDs.
The runtime listens on Railway's injected PORT;
do not hardcode an external port. Set runtime values from `.env.example`:

- APP_ENV, APP_URL and a random BETTER_AUTH_SECRET of at least 32 characters.
- DATABASE_URL: pooled `eventdesk_runtime` URL with `sslmode=verify-full`.
- WASABI_ENDPOINT, WASABI_REGION, WASABI_BUCKET and environment-specific upload keys.
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD and MAIL_FROM.
- PROXY_MODE and EDGE_SHARED_SECRET once Cloudflare is configured.
- GOOGLE_PLACES_API_KEY only if real address lookup is enabled and budgeted.

Do **not** put DIRECT_DATABASE_URL, legacy source credentials, backup credentials
or QA seed flags in the running production app. The runtime does not need DDL.
Set a restart policy and alert on repeated readiness failures and unexpected exits.
Verify the image uses the non-root `node` user and terminates cleanly on SIGTERM.

The liveness endpoint is `/api/health/live`; readiness is `/api/health/ready` and
requires database schema plus bucket access. Health routes intentionally bypass the
edge secret to support Railway probes, and expose no connection details.

## Neon

The two projects listed in `readiness.md` already exist and have four migrations.
Retrieve credentials through the provider's secure controls, never documentation.
Runtime is `eventdesk_runtime`, a SQL-created non-admin login. Owner credentials
belong only in migration/backup jobs. Do not replace the runtime user with a
console/API-created role that inherits Neon administrative capabilities.

For a future environment: migrate with the direct owner URL, provision the runtime
role using `scripts/provision-runtime-role.ts`, and verify permissions using
`scripts/verify-database.ts`. The provisioning script is deliberately one-time;
it refuses silent password rotation. New tables require explicit grants in their
reviewed migration; there are no blanket default privileges on future tables.
Review connection limits and autoscaling before adding Railway replicas: each
instance can use up to ten pooled connections.

## Wasabi

Create private upload buckets with versioning enabled and unique credentials for
staging/production. The server streams authorized reads; browsers do not receive
access keys or direct public object URLs. No permissive browser CORS or public ACL
is needed. Apply least privilege from `infra/wasabi-upload-policy.example.json`
after substituting the actual bucket name. Add an HTTPS-only bucket policy from
`infra/wasabi-https-policy.example.json` after review.

Backups need separate credentials and bucket/prefix access. Permit only required
backup writes/reads and multipart operations; do not grant object deletion to the
routine backup job. Enable versioning, review object-lock options and retain
credentials for controlled restoration. Configure lifecycle/retention only after
checking account retention and deletion billing terms. Policies have not been applied.

Test Wasabi HeadBucket, upload, read, delete and multipart operations with synthetic
objects. Verify anonymous access and the other environment's key are denied. Then
copy real source objects with `scripts/migrate-objects.mjs`; source stays intact.

## Cloudflare DNS and TLS

First configure each exact hostname as a Railway custom domain and verify its
origin certificate. Use the CNAME targets Railway actually supplies. After that,
enable Cloudflare proxying and Full (strict) SSL. Do not use Flexible SSL.

Set a request-header modification rule scoped to each EventDesk hostname to
**overwrite** `X-Eventdesk-Edge-Secret` with the corresponding environment secret.
Set that value in Railway, then enable `PROXY_MODE=cloudflare`. The app validates
the secret and Cloudflare client IP and overwrites spoofable identity/proxy headers.
Test the Railway URL without this secret returns 403 except exact health paths.
Keep the secret out of responses/logs. Confirm the Cloudflare plan supports the
chosen rule; do not enable the gate before the rule is active.

Bypass cache for `/api/*`, owner pages, authenticated responses, proposals and
customer documents. Never configure a site-wide Cache Everything rule. Hashed
`/_next/static/*` assets alone can be cached immutably. Verify cookies, booking
links, private documents and sign-out through the real edge.

Provider references: [Railway deployment CLI](https://docs.railway.com/cli/up),
[Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/),
[Cloudflare header rules](https://developers.cloudflare.com/rules/transform/request-header-modification/),
[Wasabi bucket policies](https://docs.wasabi.com/docs/bucket-policy).
