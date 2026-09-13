# Multiple brands

Open **Business settings → Branding → Add another brand**. Enter a name and public email, choose a logo and accent color, and assign packages. Save, then use **Copy booking link** or **View booking page**. A new brand starts with no assigned packages. Choosing “All current and future packages” includes future catalog additions automatically. Private packages remain hidden in the catalog.

The primary identity keeps its existing settings and booking links. Additional brands share the business workspace, staff, availability, tax/payment settings, clients, and reporting. A brand is not a separate independent business account. Manual booking and proposal forms offer a Brand selector; staff can still choose any workspace package. Package assignments control the brand's customer booking pages.

Each secondary brand has its own name, public contact information, logo, color, booking headline/introduction, message signature, and proposal/invoice footer. Images use the existing media library. Brand-specific custom domains, separate merchant accounts and email delivery are not provisioned by this feature.

## Data and access

Social links for an added brand are in **Business settings → Branding → Edit brand → Social media**. Facebook, Instagram, YouTube and TikTok accept full HTTPS profile/page URLs. Save the brand to publish these links in the booking catalog footer and package booking contact section. Blank fields hide the corresponding link. Links are optional for existing brands; older clients that omit these fields preserve saved links. No schema migration is required.

- Saved in tenant-scoped `resources`, `kind='brands'`. No schema migration or data backfill is required. IDs and media/package assignments are validated on the server against the authenticated owner's business.
- Public routes use `?business=…&brand=…`; package routes preserve `?brand=…`. Invalid, archived, foreign and unassigned package/brand combinations are rejected.
- Online requests retain the current approval workflow; quote tokens include the brand snapshot. Idempotent submissions remain idempotent.
- Secondary brand details are captured in `event_operations.data.brand`. Editing/archiving a brand does not rewrite historical proposals, invoices or message signatures. Selecting another brand on an event captures that identity; choosing the primary brand removes the secondary snapshot.
- Archived brands cannot take new public bookings. Restore them from **Show archived brands**. Their media objects are retained for historical documents; logos cannot be removed from the media library while a brand still references them.
- The public-launch mirror uses the same domain model with PostgreSQL and Wasabi behind the existing adapters.

## Validation and rollback

`node tests/brands.mjs` exercises real beta routes against migrated in-memory SQLite: create/edit/archive/restore, invalid fields, tenant/media/package isolation, public catalog filtering, logo authorization, brand-bound quote tokens, online approval requests, submission idempotency, manual event selection, proposal snapshots and message placeholders. Public-launch `tests/platform/brands.test.ts` validates the same persistence helper against PostgreSQL using PGlite.

To roll back application code, redeploy the prior version. No existing business, package or event is deleted or migrated by enabling multiple brands. New brand records and event snapshots can remain in storage during a rollback; older code ignores the additional fields. Re-enable the feature to restore management access.
