# EventDeskly marketing homepage

## Pricing update — September 12, 2026

The pricing announcement described in the original implementation below has been
replaced with the user-approved Standard, Growth and Unlimited plans. Annual is
selected by default. Monthly/annual selection updates card prices, charge text,
annual savings, comparison rows and all signup URLs. Standard is Most Popular.
The offer is a **30-day trial with no card required**, approved by the user.
`trialDays` in `lib/marketing-pricing.ts` is shared by pricing and signup copy and
must be used when trial activation is implemented. The 60-day money-back guarantee
is separate from the trial; its eligibility/start-date policy still needs definition.
This copy update does not start a subscription or trial countdown.

| Plan | Monthly | Annual monthly equivalent | Annual charge | Savings |
| --- | --- | --- | --- | --- |
| Standard | $29 | $19 | $228 | $120 |
| Growth | $69 | $49 | $588 | $240 |
| Unlimited | $179 | $129 | $1,548 | $600 |

Each card includes the approved administrator/brand/staff allowances, a keyboard
accessible booking tooltip and an independent feature disclosure. Permanent text
also explains that booking limits count upcoming active bookings, not lifetime
bookings; all three plans are unlimited. The comparison table uses scoped headers,
wraps within narrow screens and follows the billing selection.

Pricing-update files:

- `components/marketing/pricing.tsx`: interactive cards, toggle, tooltips,
  disclosures, trust points and comparison table.
- `components/marketing/pricing.css`: white, blue and cyan responsive styles.
- `lib/marketing-pricing.ts`: shared approved prices, calculations and signup URLs.
- `components/marketing/signup-plan.tsx`: selected-plan summary on signup.
- `app/sign-in/page.tsx`: displays that summary in registration mode only.
- `components/marketing/home.tsx`: mounts the completed pricing section.
- `components/marketing/content.ts`: removes the outdated pricing announcement.
- `tests/marketing-pricing.test.ts`: approved values, savings claims, all six
  signup selections and invalid-selection handling.
- `docs/marketing-homepage.md`: this update.

All Choose buttons use `/sign-in?mode=signup&return_to=%2Fapp&plan=…&billing=…`.
The chosen plan and billing period are shown on the registration screen. No
checkout route exists. Selection does not create a paid subscription, charge a
card, start a timed trial or persist subscription entitlements. Payment-provider
products/prices, checkout/webhooks, trial/refund implementation and administrator,
staff and multi-brand entitlements still require backend configuration. The site
labels those allowances as planned rather than claiming those features are active.
Existing signup continues to depend on the configured database and SMTP services.

Validation: pricing calculation/URL tests, existing unit suites, typecheck and
scoped pricing lint pass. The full lint command was run and continues to report
the previously documented repository-wide errors. Production build and local
marketing-route regression checks pass. Browser verification covers annual and
monthly prices and links, feature expansion, keyboard tooltip, signup plan summary
and responsive layouts. No account or payment was submitted during verification.

September 12, 2026. Implemented in the existing React 19 / TypeScript / Vinext
App Router project with Tailwind, scoped CSS, Lucide and the installed Base UI
Tabs and Accordion components. Hosting remains Railway. No dependencies,
database schemas, authentication permissions or production configuration changed.

## Delivered

A bright blue/cyan homepage with the supplied transparent logo, sticky navigation,
responsive menu, hero, six audience cards, eight feature groups, three-step flow,
benefits, interactive product preview, alternating product sections, website
widgets section, pricing status, FAQ, demo status, final CTA and organized footer.
Product visuals are lightweight HTML interface illustrations using fictional
sample data. They are not screenshots, customer evidence or revenue claims.
The original logo asset remains unchanged; a CSS filter makes its white lettering
readable on the light marketing header.

Metadata includes title, description, canonical URL, Open Graph and Twitter card
fields. `marketingConfig.socialImage` supports an approved 1200 × 630 image;
image metadata is omitted until an actual image is supplied.

## Routes and interactions

| Destination | Behavior |
| --- | --- |
| `/` | Public marketing page. Verified signed-in owners go to `/app`. |
| `/welcome` | Marketing page accessible regardless of sign-in state; canonical URL is `/`. |
| `/app` | Existing CRM workspace. Server APIs retain their existing authentication and tenant checks. |
| `/?section=…` | Redirects to `/app?section=…`, preserving repeated query parameters and editor/panel state. |
| Get Started | `/sign-in?mode=signup&return_to=%2Fapp` opens the existing registration form. |
| Log In | `/sign-in?return_to=%2Fapp` opens existing sign-in. |
| Product / Solutions / Pricing / Resources | Link to populated homepage sections. |
| Book a Demo | Links to the demo availability section until an approved booking URL is configured. It does not send a request or reserve a time. |
| Product preview | Three selectable tabs; arrow keys move focus and Enter selects. |
| FAQ | Keyboard-operable accordion. |
| Mobile navigation | Toggle exposes navigation; Escape closes it and restores toggle focus. |

Registration and email verification still depend on the existing Better Auth,
database and SMTP configuration. Opening a form does not verify email delivery.

## Product claims checked against source

Sources: `docs/readiness.md`, `docs/qa-report.md`, `app/overview-dashboard.tsx`,
`app/proposal-document.tsx`, `app/workspace.tsx`, `lib/workspace-navigation.ts`,
`lib/settings.ts` and `app/sign-in/page.tsx`.

- Proposals, reusable booking/contract terms and invoices exist. Electronic
  signatures do not. The supplied hero wording was adjusted accordingly.
- Offline payment records and balances exist. Online payment processing is not
  connected and is not advertised as active.
- Message drafts/templates exist; email/SMS delivery and automated sending do not.
- Reusable questionnaires/checklists exist; the page describes these instead of
  claiming unattended workflow automation.
- Staff rosters, assignments and availability exist. Independent staff logins
  and permissions do not; the FAQ states that limitation.
- Reports, packages, bookings and website booking/lead/availability tools exist.
- No third-party integration logos, testimonials, customer logos, ratings or
  business-performance statistics were invented.

## Business information still needed

Edit `components/marketing/content.ts` when approved:

1. Demo booking URL (or approved sales contact and demo-request workflow).
2. Actual plans, prices, billing intervals and any trial/offer terms. The current
   pricing announcement is provisional; no prices or free-trial promises exist.
3. Support email and published company contact information.
4. Reviewed privacy and terms pages. Footer labels are non-clickable while absent.
5. Approved social-profile links. No guessed handles are used.
6. Approved sharing image. Open Graph image support exists but no image is claimed.
7. Final approval of the feature-limit wording and owner-only access description.

## Changed files

- `components/marketing/home.tsx`: page sections, CTAs and footer.
- `components/marketing/content.ts`: approved-content slots, metadata, FAQ.
- `components/marketing/interactive.tsx`: navigation, tabs and accordion.
- `components/marketing/previews.tsx`: reusable sample interface previews.
- `components/marketing/marketing.css`: scoped responsive theme and reduced motion.
- `app/page.tsx`: public landing page and compatibility/session redirects.
- `app/app/page.tsx`: CRM route and no-index metadata.
- `app/welcome/page.tsx`: alias replacing the earlier draft (old draft CSS removed).
- `app/sign-in/page.tsx`: signup entry mode and `/app` callback default.
- `app/workspace.tsx`: updated sign-in return destination.
- `lib/workspace-navigation.ts`: canonical CRM URLs use `/app`.
- `app/booking-preview/preview.tsx`, `app/proposal/[id]/page.tsx`,
  `app/sign-out/page.tsx`: return-to-workspace links use `/app`.
- `tests/marketing-routes.mjs`: read-only local HTTP route/metadata checks.
- `tests/workspace-navigation.mjs`: assert every CRM link remains under `/app`.
- `docs/marketing-homepage.md`: implementation and business review notes.

## Validation

- `npm run test:unit`: passed all three maintained unit suites.
- `node tests/workspace-navigation.mjs`: passed destination, scope, URL and
  dashboard-preference checks, including the new `/app` assertions.
- `node tests/marketing-routes.mjs`: passed homepage/alias rendering, metadata,
  registration link, legacy query preservation and separate CRM route checks.
- `npm run typecheck`: passed.
- Scoped lint of new marketing components, routes and HTTP test: passed.
- `npm run lint`: fails on existing repository-wide findings, including explicit
  `any` in platform tests, FormData stringification in existing auth code and
  legacy test harness eval rules. These were not suppressed or broadly rewritten.
- `npm run build`: passed standalone packaging, client-asset validation and
  compression. Existing middleware deprecation and large-chunk warnings remain.
- Browser checks: 1440px desktop, 768px tablet, 390px and 320px mobile; no horizontal
  overflow. Verified tab selection, keyboard arrow/Enter selection, FAQ expansion,
  mobile menu/Escape, public root, signup/sign-in entry forms and demo fallback.
- Full authenticated account lifecycle, real SMTP, hosted deployment and database
  integration suites were not exercised by this marketing change. Successful
  authenticated root redirection still needs staging acceptance with a real test
  session; unauthenticated and legacy routing were checked locally.

The preview is local. No public DNS, deployment or customer data was changed.
