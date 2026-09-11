# Strict QA report

September 10, 2026. Verdict: **do not cut over publicly yet**. This report covers
the isolated migration build with synthetic Neon data and a loopback S3 fixture.
It is not evidence of a deployed Railway/Wasabi/Cloudflare stack.

Severity definitions: Critical permits identity/tenant compromise; High risks
data loss, broken core workflows or an unusable release; Medium degrades a
workflow/operability; Low is minor presentation or maintenance impact.

## Fixed findings

| ID | Severity | Reproduction before fix | Fix | Regression / result |
|---|---|---|---|---|
| AUTH-01 | Critical on an untrusted Node origin | Send forged `oai-authenticated-user-id` headers to the CRM API without a session | Derive identity exclusively from Better Auth; strip legacy/proxy identity headers | `platform/api.test.ts`, `http.test.ts`: forged requests return 401/403 |
| DB-01 | High | Execute SQLite JSON/date SQL on Postgres while editing quotes/templates | Explicit SQL/JSON port, parameter adapter and versioned compatibility functions | PGlite SQL tests plus real-Neon pricing, management, templates and public-booking suites pass |
| DB-02 | High | Race two confirmations for the last available business/date capacity | Serializable transactions and bounded retries, preserving conditional writes | `platform/concurrency.test.ts`: exactly one insert succeeds; failed tenant FK rolls back prior write |
| DB-03 | High | Toggle `tasks[0].done`; task ID/label disappear from nested JSON | Migration 0002 indexes JSON arrays correctly instead of treating the index as an object key | `platform/postgres.test.ts` and `scripts/verify-database.ts`: ID, label and sibling task survive |
| DB-04 | High | Inspect a Neon API-created app role; it inherits administrative capability | Replace it with SQL-created `eventdesk_runtime`, explicit DML grants, no DDL/admin flags; remove unused broad role | Real Neon role flags false; CREATE TABLE denied with 42501 |
| DB-05 | High | Open a public proposal/invoice whose server-rendered page still uses SQLite extraction | Port remaining `.tsx` query expressions to PostgreSQL helpers | `platform/proposals.test.ts`: actual proposal and invoice HTML return 200 with package details |
| HTTP-01 | High | Submit a JSON write while an early body-counting data listener consumes the request | Count at the stream producer without pre-consuming framework body input | API writes and complete workflow suites pass; oversized body returns 413 |
| FILE-01 | High | Upload/read a file on Node with no R2 binding; attachment code also shadows the storage binding | Private S3 adapter and explicit storage alias; preserved business key paths | Package/photo/document tests pass; foreign-owner and private tokenless reads denied |
| FILE-02 | High for migration | Run object-copy with an async generator unsupported by SDK Upload | Wrap source generator in a Node Readable; retain hash/readback checks and no-overwrite guard | `platform/object-migration.test.ts`: bytes/type/hash preserved, repeat refused, source retained |
| UI-01 | Medium | Navigate workspace sections; CSS-only entry is referenced as a missing JavaScript asset | Import shared CSS once; fail build if any server-manifest client asset is absent | Asset manifest verifies 54 references; 116 desktop/mobile views have no failing static assets/page errors |
| PERF-02 | Medium | Load cold Overview at 1.6 Mbps, 150 ms latency, 4x CPU slowdown | Lazy-load optional workspace panels; precompress public immutable JS/CSS with Brotli/gzip | Local mobile LCP improved from 5.09s to 1.44s; CLS 0.0957; compressed response decodes to exact build bytes |
| NET-01 | High on the new proxy stack | Supply forged forwarding headers at the origin to influence identity/rate-limit IP | Edge secret gate and validated Cloudflare IP; strip supplied identity/forwarded headers | `platform/http.test.ts`: unauthorized origin denied; exact health routes alone bypass the gate |
| OPS-02 | Medium | Database connection failure leaks low-level error or sales write reports a client error | Generic connection/storage failure boundary and sales 503 mapping | Safe logging/error handling reviewed; external DB outage drill remains a release check |
| AUTH-03 | Low | Ninth invalid sign-in returns 429 but only library-specific X-Retry-After | Translate to standard Retry-After and no-store on auth throttles | `platform/http.test.ts` checks eight failures then 429 with positive retry delay |
| OPS-03 | Medium | An upstream object store accepts a connection but never responds to the bucket probe | Set connection/request timeouts and a five-second abort for the storage readiness probe | `platform/storage-timeout.test.ts` injects a stalled upstream and requires a bounded failure |
| RELEASE-02 | High | After a new build finishes, readiness returns 200 from the still-serving old version | Stamp the artifact with the tested SHA and require that exact SHA in the release probe; specify the Railway project explicitly | `platform/release.test.ts`: older healthy commit fails; intended healthy commit passes |
| HTTP-02 | Medium | A broad public-route prefix also matches the owner-only booking preview, while omitting public scheduling | Use route boundaries and include the actual public schedule route | `platform/http.test.ts`: owner preview disallows external framing; public scheduling permits HTTPS embedding |

Test-only fixes: legacy fixtures used obsolete Sites cookies/redirects and SQLite
environment mocks. They now use actual synthetic Better Auth sessions and the
configured Node environment where ported. Management fixtures isolate pricing
rules and restore settings. Shared rate counters reset **between** synthetic
scenarios after verifying the two-business QA database; limits remain enabled
inside each scenario. These were test harness problems, not disabled protections.

## Coverage and evidence

| Area | What was tested | Limit |
|---|---|---|
| Build and dependencies | TypeScript, standalone build, complete client-asset manifest, npm audit with zero reported vulnerabilities | Registry audit is not a penetration test; Docker build not executed locally |
| Database | Full schema/functions, quoted parameters, tenant FKs, transaction rollback, two-request capacity race, restricted runtime login | No large-data/import/restore drill |
| CRM and packages | New verified-owner fixture → business → package → direct confirmed booking, lead/proposal progression, combined pricing, taxes/deposits, hourly/unit scheduling, package/service/group clone/delete/visibility/bulk actions, booking links and images | Maintained API cases; not every possible configuration permutation; real email verification still untested |
| Public booking | Catalog visibility/tenant scopes, quote validation, extras, stale totals, availability, retries, request approval behavior | Live payment and real external address provider unavailable |
| Proposals | Actual rendered preview/invoice, package details, private fields excluded, attachment upload/visibility, cross-owner denial, share/revoke/regenerate/delete | E-signature and payment-provider processing not implemented |
| Management | Add-ons/backdrops, discounts/flex pricing, message draft templates, questionnaires/planning samples, checklists, designs, staff scheduling, website integration | Email/SMS delivery, third-party design sync and staff login memberships unavailable |
| Sales and personal options | Sales records/reports/tasks/expenses/offline payments; actual profile save/reload, stale update rejection and support draft persistence; all personal pages render | Remaining legacy personal-options assertions still need a full PostgreSQL port |
| Browser | 58 sections at 1440px and 390px = 116 page checks, no page overflow or missing static assets | Chromium/Chrome only; render checks do not exercise every button/modal |
| Numeric forms | Mobile package zero clearing, typed deposit and hourly values, spinner behavior and visible field width | Targeted regression for the user's earlier input bug |
| Performance | Cold synthetic Overview, throttled network/CPU: LCP 1.44s, CLS 0.0957, long-task duration about 1.37s | Local lab result; not field Core Web Vitals, INP, Lighthouse or a load test |
| HTTP/security | Identity/proxy spoofing, wrong origin, body limit, security headers, auth throttling, query-secret logging, revocation, foreign business/file denial | Real edge/TLS/cookie and outage behavior must be tested after deployment |
| S3 copy | Stream compatibility, bytes/type preservation, SHA-256 readback, overwrite refusal and source retention | Local protocol fixture; actual Wasabi and multipart provider behavior unverified |

The maintained workflow names and latest outcomes are recorded in `qa-evidence.json`.
Private raw logs/screenshots are in ignored `artifacts/`; do not publish session
artifacts or customer data. GitHub CI uploads only selected non-secret evidence.

## Unresolved findings and acceptance tests

| ID | Severity / state | Reproduction or verification gap | Required fix | Required regression / acceptance |
|---|---|---|---|---|
| RELEASE-01 | High — blocked on access | No GitHub destination configured; Railway CLI unauthorized; no Cloudflare domain | Supply/connect destination and create isolated services/environments; configure exact deploy workflow and DNS | Green hosted CI + Docker run, dev deployment, main promotion, exact commit/readiness and rollback |
| STORAGE-01 | High — blocked on access | Runtime uses an ephemeral fixture; real Wasabi calls cannot be exercised | Configure private buckets/keys/versioning and migrate source objects | Signed Head/Put/Get/Delete/multipart success; anonymous and other-environment denial; hashes reconcile |
| ACCOUNT-01 | High — blocked on SMTP | Public signup/recovery cannot be relied on without a real sender | Configure verified SMTP account and sender domain; verify delivery and error handling | Signup→email→verify→login; wrong/expired link; reset→old session denied; no account-enumeration leak |
| DATA-01 | High — pending source export | Production has zero businesses and owners; existing beta identities have no reviewed mapping | Export customer tables/files; verify owner mapping; rehearse and reconcile isolated import before final freeze | Counts, money totals, quote history, tenant access, links and file inventory match; source retained |
| RECOVERY-01 | High — unverified | No real backup has been restored; Docker/pg_dump absent locally | Configure scheduled private backups and run a timed isolated restore drill | SHA-256 + pg_restore + schema/count/total/file/permission checks; record actual RPO/RTO and alert delivery |
| QA-01 | Medium — incomplete coverage | `booking-create.mjs`, `booking-venue.mjs`, `proposal-workspace.mjs`, `user-options.mjs` use SQLite mock harnesses; original `workflow.mjs` mutates broad fixtures | Port remaining harnesses or map each assertion to isolated PostgreSQL/API/browser cases; new onboarding/basic profile and proposal cases now have replacements | Complete the assertion mapping, remaining personal document actions, real email flow and user acceptance |
| PERF-01 | Medium — pending scale test | Overview snapshot can include all business records; only synthetic small tenants profiled | Measure realistic data sizes/concurrency; paginate or bound snapshot work where thresholds fail | Representative tenant load, concurrent request latency/error rate, pool saturation, memory and mobile INP results |
| ROLE-01 | Medium product gap | Staff roster person cannot sign in with restricted access | Keep owner-only scope explicit; implement memberships/invitations/roles if staff login is required for launch | Owner/admin/staff/customer permission matrix, cross-role denial, revocation and invite expiry |
| PRODUCT-01 | Medium product gap | Message sending, payment processing, subscriptions, e-signatures and some external integrations remain inactive | Complete provider integrations as separately scoped product work; do not present them as live | Sandbox transaction/delivery/webhook tests and explicit user acceptance |
| RUNTIME-01 | Medium operational risk | Vinext dependency is a beta release; container and real edge not soak-tested | Keep lockfile pinned, complete Docker/hosted staging soak and browser matrix | Chrome/Firefox/Safari, cookie/TLS checks, restart/rollback and dependency-update regression suite |

No final production-readiness claim should be made until the High release gates
are closed and the intended launch scope is accepted. The separate beta remains
the user-facing deployment while these checks are outstanding.
