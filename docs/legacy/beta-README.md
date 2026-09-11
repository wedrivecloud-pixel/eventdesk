# EventDesk

CRM for independent event businesses, with public package booking requests. Each signed-in owner has a separate workspace. Thirteen service categories and custom services are supported.

## Available

- Business profile, branding color and logo uploads (PNG/JPEG/WebP, 2 MB maximum).
- Package overview, General, Pricing & Scheduling and Advanced editors; primary image and up to ten gallery photos (PNG/JPEG/WebP, 5 MB each), visibility and grouping.
- Package hourly/daily rates, duration bounds, separate booking/slot increments, per-unit or flat unit-range tiers with included units, deposit overrides, weekday-specific start limits, labeled start/end slots, lead time, staff/backdrop requirements and included extras.
- Add-ons, backdrops, design collections, discount codes and day/date-based flexible pricing.
- Booking-page header/CTA settings and an owner-only booking preview that creates leads.
- Default tax, travel, deposit, payment due date, proposal introduction and booking terms.
- Leads, combined-service quotes, printable proposals, booking confirmation and reopening for changes.
- Calendar, business-wide daily booking limits, minimum booking notice and blackout dates.
- Staff roster and event assignments; contract, checklist and questionnaire templates with per-event tasks and answers.
- Message templates with merged event fields and copy-to-clipboard; automated-message drafts with sending off.
- Offline payment recording with remaining-balance checks, expenses and basic reports.
- Search, editing, recoverable archiving and restoring management records.

## Still needed for a public launch

Platform subscriptions and operator administration, staff login invitations and permissions, public client portals, electronic signatures, live payment-provider onboarding, email/SMS delivery and scheduled automations, calendar sync, and equipment/staff-specific availability. The integration page shows these connections as inactive. Do not describe this version as full Check Cherry feature parity.

All amounts use USD. Packages can use a per-unit quantity; add-ons use one unit each. Tax is business-entered and applied to the discounted package/extras amount; travel is added separately. Distance is entered manually. Quotes snapshot package and extra prices, pricing rules, tax/travel/deposit settings and proposal terms. Reopening a booking permits changes; its total cannot fall below recorded payments. Confirmed schedule changes require reopening. Daily availability limits apply across the business, not per resource.

## Architecture

Cloudflare Worker-compatible Vinext/React app with ChatGPT sign-in, D1 records and R2 logo/package-image storage. SQL always scopes records to the server-derived owner business. Generated Drizzle migration history is append-only. Event and quote writes are batched; capacity and payment balance conditions are part of the relevant SQL mutation. Private notes, planning answers and team information do not appear on printable proposals. Integration credentials are not stored in general settings.

## Validation

`npx tsc --noEmit` and `npm run build`. Local-only test scripts:

- `tests/workflow.mjs`: original onboarding and lead-to-booking workflow, validation, price snapshots and proposal privacy.
- `tests/tenant-isolation.mjs`: real second-business fixture excluded from reads, writes and proposal access.
- `tests/pricing-scheduling.mjs`: additive/range tier arithmetic, included units, legacy rates, percentage deposit basis, independent slot intervals, weekday rules, labeled slots, day ranges and atomic capacity.
- `tests/packages.mjs`: package configuration, pricing/schedule rules, quote snapshots, image storage/primary selection/removal, validation and image ownership.
- `tests/package-catalog.mjs`: public package selection, tenant and visibility filtering, service/group ordering, image links, branding and empty/missing catalogs.
- `tests/public-booking.mjs`: anonymous request flow, server pricing, private-data exclusion, image scope, duplicate submissions, stale quotes, approval status, availability and rate limits.
- `tests/management.mjs`: settings, combined pricing, template application, task/answer persistence, staff ownership, offline payment balance, blackout/capacity enforcement and unsafe logo rejection.

Tests use sample localhost data and require generated migrations plus fixtures. Management tests intentionally change local pricing and availability. Never run test scripts against customer records. WebMCP exposes read-only navigation to the available sections. No automatic email or charge happens during these flows.

Package images save immediately; package fields save together. Existing quotes snapshot the original package rules and rates; changing event length/quantity uses those original rates. New percentage deposits use each package’s share of the complete booking total; historical package deposits retain their original line-price basis. Daily rentals check each occupied date against business capacity and blackouts, including atomic approval of overlapping ranges. Resource availability and conflict detection still apply only at the business daily-limit level; automatic slots express configured hours, not equipment/staff availability. Online package requests always create leads with source Online booking request and record the package request type in event operations. Image cropping and rich-text editing are not included. Legacy quantity multipliers, hour-based date-only packages and event-fit availability windows remain unchanged until explicitly converted in the editor.

The Check availability page at `/reservation/start?business=ID` lists all Public packages from a business’s enabled services, grouped and sorted as in Package Manager. Clients compare photos, descriptions, included hours and starting prices, then choose a package and enter the existing approval-request flow. Private and Disabled packages are excluded. Each business has its own shareable catalog link in Package Manager and Booking engine settings; `/reservation/start` without an identifier redirects a signed-in owner to their own catalog and asks anonymous visitors to sign in. An empty catalog offers business contact details. Individual package pages link back to their business’s catalog.

Package overview includes a copyable client link and HTML website link at `/book/ID`. Anonymous clients see that package, its photos and business contact details, select event details and extras, review a server-calculated estimate, and submit a request for owner approval. Public and unlisted/Private packages accept direct requests; Disabled packages and disabled services return 404. The existing `/booking-preview` remains owner-only. Public Sites access is required for external clients; CRM APIs, proposals, and administration retain authentication and business ownership checks.

Public APIs explicitly project only customer-facing data. Business ownership derives from the selected package; client totals and business IDs are ignored. Submission checks current prices, schedules, notice, blackout dates, daily capacity, extras and coupon codes. A quote token prevents silent price changes; a client-generated UUID makes retries idempotent. Rate limits and a honeypot reduce automated abuse. Requests do not reserve dates or send email. Travel estimates include the base fee; distance charges need owner review. Gallery and logo image reads require an enabled package and are scoped to its business. Requests are visible in Leads; approving a booking still follows the existing proposal and confirmation workflow.

Package Manager groups the catalog by service and package group, including searchable empty services/groups. Service and group menus support editing, duplication, package visibility, confirmed permanent deletion, reordering, and scoped booking links. Groups can move between services. Package menus support editing, duplication, visibility, moving, deletion and direct booking links. QR codes and HTML links are generated locally. Existing proposals, bookings and quoted prices survive catalog deletion. Copied packages start as Private with independent package images. Collection images use immutable bytes with independent references, so replacing/removing the source image does not affect a copy.

Bulk Edit opens a dedicated table with individual, group and service selection (maximum 100 packages). It supports visibility, service/group moves, absolute/relative prices, taxability, duration and unit rates, deposit overrides, scheduling modes, weekdays/hours, and advanced package settings. Only explicitly selected fields change. The server validates every selected package and extra before a single batched update. Mixed taxable/non-taxable quotes allocate adjustments/discounts proportionally; historical line settings stay fixed. Service/group editors include name visibility, subheaders and primary-image upload/removal. Their saved presentation appears on the public catalog.

`tests/package-manager-actions.mjs` exercises service/group cloning and deletion, bulk validation, scoped links, images, mixed taxability and historical-data preservation. `node tests/run-workflow-checks.mjs` isolates the original workflow/management checks from prior local pricing rules and restores settings afterwards. See `PACKAGE-MANAGER-COMPARISON.md` for the inspected reference surfaces and remaining differences; full Check Cherry parity is not claimed.

## Sales workspace

The Sales dropdown includes Bookings, Proposals, Leads, Appointments, Calendar, To-do List, Messages, Staffing, Expenses, Payments, and Reporting. See [SALES-MENU-COMPARISON.md](SALES-MENU-COMPARISON.md) for the inspected reference workflows, implemented controls and remaining differences.

Messages support drafts and review only; delivery and payment-provider setup remain deferred. Sales records use tenant-scoped D1 storage; private expense receipts use R2. Recurring expenses catch up when the owner opens/saves the workspace. Canceled bookings preserve history and release availability; restored confirmed records return to proposals for a fresh availability check.

Additional local checks: `node tests/sales.mjs` and `node tests/sales-reports.mjs`.
