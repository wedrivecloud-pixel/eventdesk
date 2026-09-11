# Public launch audit — 2026-09-10

Baseline: beta v35, commit `7ac422fc23b6527bb34950e73373b07e2f7e29b8`.
The read-only audit was delivered before editing. Migration work is isolated from
the original checkout and Sites deployment. No customer data has been migrated.

| Area | Required change |
|---|---|
| Runtime | Workers to Node standalone, Docker and Railway PORT/shutdown |
| Database | 39 database modules; Drizzle Postgres schema, JSON/date SQL port, serializable guards |
| Identity | Replace Sites identity headers with verified Better Auth sessions and account recovery |
| Permissions | Preserve tenant isolation; roster records must not become owner accounts |
| Files | Replace R2 with private Wasabi objects; inventory and verify existing file migration |
| Operations | Validated env, health/readiness, redacted logs, shared limits, backup and restore |
| CI/CD | GitHub checks; dev→staging, main→production with migration gates |
| DNS | Validate Railway first; Cloudflare DNS and Full (strict) TLS afterward |
| QA | Port legacy tests; real Postgres concurrency/permissions; browser/mobile/performance |

## Initial findings

| ID | Severity | Reproduction / impact | Fix and required regression |
|---|---|---|---|
| AUTH-01 | Critical on Node | Forged oai-authenticated-user headers accepted as identity | Verified sessions; forged-header request must return 401 |
| DB-01 | High | Existing SQLite SQL fails on Postgres | Explicit SQL port; exercise all guarded writes |
| DB-02 | High | Parallel capacity/discount/payment requests | Serializable transactions with bounded retries; concurrency tests |
| FILE-01 | High | Railway has no R2 binding | Wasabi adapter; scoped read/write/delete tests |
| OPS-01 | High | No repeatable backup/restore/release process | Migrations, backup inventory and restore drill |
| AUTH-02 | High | Staff roster is not a permissioned login | Keep access owner-only until membership roles are implemented and tested |
| PERF-01 | Medium, measurement pending | Snapshot loads all records and materializes expenses | Profile realistic tenant sizes and bound expensive work |
| NET-01 | High | CF-header rate limits on different proxy stack | Trusted proxy boundary and spoofing tests |

## Constraints

Keep the beta live until record/file/owner migration and rollback are verified.
Staging should use synthetic records. Do not commit client records or secrets.
Live email/SMS, payments and electronic signatures were deferred features and
are not made operational by moving hosting. Final QA must identify their status.
GitHub destination, Railway workspace, domain and Wasabi configuration await user
input; existing unrelated Neon projects are excluded.

References: [Vinext](https://github.com/cloudflare/vinext),
[Better Auth](https://better-auth.com/docs/installation),
[Railway health checks](https://docs.railway.com/deployments/healthchecks),
[Cloudflare TLS](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
