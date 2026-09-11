# Public launch readiness

Assessment: September 10, 2026. **61/100 — NO-GO for public cutover.** This is an
engineering readiness rubric, not a percentage of tests passed or a security certification.
The original v35 Sites beta has not been replaced.

## What exists

- Isolated migration branch `codex/public-launch-migration`, based on beta commit
  `7ac422fc23b6527bb34950e73373b07e2f7e29b8`.
- Node standalone app, Better Auth, PostgreSQL port, private S3 adapter, Dockerfile,
  health checks, request logs, bounded writes, proxy/origin checks and shared rate limits.
- Separate Neon staging and production projects, both migrated with restricted
  runtime logins. Staging contains synthetic data. Production is verified empty.
- GitHub validation/deployment/backup workflows and migration/import/backup tools.
- Local functional, tenant-isolation, concurrency, browser and performance evidence.

## Score

| Area | Earned / possible | Reason for remaining points |
|---|---:|---|
| Runtime and portability | 13 / 15 | Standalone build works; Docker image not built or run here; framework is a pinned beta |
| Database and data transition | 12 / 20 | Schema, grants and synthetic workflows pass; real export/import and recovery unverified |
| Authentication and security | 12 / 15 | Sessions, ownership, token revocation, origin/proxy protection and throttling pass; live verification/reset email and complete permission acceptance remain |
| Object storage | 3 / 10 | S3 adapter and copy tests pass against fixtures; Wasabi buckets, permissions and real object migration absent |
| CI/CD, hosting and edge | 4 / 15 | Workflow/config files prepared; GitHub destination, Railway deployment and Cloudflare domain are not connected |
| Workflow, mobile and performance QA | 13 / 15 | Broad API and Chromium coverage; large-tenant load, other browsers and remaining legacy harness cases unverified |
| Operations and recovery | 4 / 10 | Backup code and runbooks present; alerts, verified remote backups and a timed restore drill absent |
| **Total** | **61 / 100** | **Hard release gates below override the score** |

## Release gates

1. Confirm GitHub owner/repository and connect the authorized Railway workspace.
   Configure staging/production environments, branch protections, secrets and
   deployment variables. Complete a real CI run and Docker startup test.
2. Configure separate private Wasabi staging/production upload buckets and backup
   storage with distinct credentials, versioning and reviewed retention policies.
   Verify signed operations, anonymous denial and environment isolation on Wasabi.
3. Connect SMTP and a verified sending domain. Test real signup verification,
   password recovery, invalid/expired tokens and session revocation through the
   public staging domain. Fixture/account-seed tests do not prove deliverability.
4. Deploy staging on Railway. Configure the selected domain in Cloudflare, verified
   origin TLS, Full (strict), proxy header secret and edge/cache rules. Test bypass
   denial, redirects, secure cookies and health checks from outside the workstation.
5. Rehearse export/import using a private legacy export and reviewed owner mapping.
   Reconcile IDs, row counts, integer-cent totals, retained quote snapshots and file
   hashes. Do not infer ownership from an unverified email address.
6. Create and restore a real backup to an isolated database. Record measured RPO/RTO,
   file recovery and alert delivery. A checksum-only backup check is not a restore drill.
7. Close release-blocking items in `qa-report.md`, run customer acceptance on staging,
   then promote the same reviewed change to `main`. Freeze legacy writes for final
   export and retain a verified rollback path before switching users.

## Resource status

| Resource | Status |
|---|---|
| Neon staging | Created: `steep-mountain-61813886`; branch `br-old-mud-akwe5aw8`; database `eventdesk` |
| Neon production | Created: `sparkling-cell-16479473`; branch `br-cold-meadow-ard8bmvb`; database `eventdesk`; empty |
| Database credentials | Ignored local environment files; not committed or placed in documentation |
| GitHub | Private repository `wedrivecloud-pixel/eventdesk` created; connector read/write access verified and limited to this repository. Source upload and hosted CI verification are in progress. |
| Railway | CLI available but unauthorized; no service deployment performed |
| Wasabi | No live bucket/credentials connected; loopback S3 fixture used for QA |
| Cloudflare | Domain/access not supplied; no DNS, TLS or header-rule mutation performed |
| SMTP | Not connected; real verification/recovery email remains untested |
| Existing users/files | Retained in the beta; not exported, remapped or migrated |

CRM email/SMS sending, payment processing, subscriptions and electronic signatures
remain separate product integrations. Staff roster entries do not grant login
access. This build supports owner workspaces and scoped public booking/proposal
routes; it is not a completed staff/client membership platform.

See `architecture.md`, `deployment-setup.md`, `runbooks.md`, `qa-report.md` and
`qa-evidence.json` for the implementation, operating instructions and evidence.
