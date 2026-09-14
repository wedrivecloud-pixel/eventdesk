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

### Brand contact and document settings

Primary brands and added brands now expose **Brand contact**, **Invoices and proposals**, **Proposals → About Us / Trust indicators**, and **Signature**. The primary brand's appearance and social links keep their existing save button; its contact and document form uses **Save brand details**. Added brands use **Save brand** for the whole form.

- Contact: name, public email, phone, website, multiline address.
- Documents: show/hide the address, optional alternate name/address/email/phone/logo, and document footer. Alternate address has line 1, line 2, city, state/province, and postal code fields. Empty alternate name/email/phone/logo uses normal brand identity. The address switch hides the full address from client document data.
- Proposals: About Us plus up to 12 unique trust indicators. Supported labels match the inspected reference: events hosted, years in business, clients served, photos taken, hours of entertainment, client satisfaction, five-star reviews, average rating, repeat customers, referral rate, awards won, team members, Google reviews, on-time rate, and response time. Values are supplied by the business; no achievements or verification claims are seeded.
- Signature: an explicit section, line-preserving preview, and instructions for `{{brand_signature}}`. Existing draft/review delivery behavior is unchanged. A proposal preset's About Us text overrides the brand's fallback text.
- Added-brand document identity and statistics come from the event's saved brand snapshot. Later brand edits do not rewrite those proposals. Primary-brand documents continue to use current primary settings, consistent with existing behavior.
- Document logo requests require event owner/share-token access and validate media ownership. Current invoice logos are protected from media-library removal; historical objects remain retained.

Reference audited read-only: `https://sipovac-photobooth.checkcherry.com/admin/brands/new`, including expanded invoice overrides and trust-indicator options. This update addresses the contact/proposal/trust/signature workflow. Remaining editor differences are recorded explicitly: Eventdeskly uses plain text with preserved line breaks instead of a rich HTML toolbar, multiline general address instead of separate address fields, and the existing added-brand single accent color/logo rather than Check Cherry's six color controls and favicon uploader.

Regression coverage also renders the real proposal/invoice component, verifies About Us and statistics on proposals only, address privacy, alternate document contacts/logos, primary-brand saves, ownership checks, omitted-field preservation, invalid indicators and unchanged historical added-brand content.

`node tests/brands.mjs` exercises real beta routes against migrated in-memory SQLite: create/edit/archive/restore, invalid fields, tenant/media/package isolation, public catalog filtering, logo authorization, brand-bound quote tokens, online approval requests, submission idempotency, manual event selection, proposal snapshots and message placeholders. Public-launch `tests/platform/brands.test.ts` validates the same persistence helper against PostgreSQL using PGlite.

To roll back application code, redeploy the prior version. No existing business, package or event is deleted or migrated by enabling multiple brands. New brand records and event snapshots can remain in storage during a rollback; older code ignores the additional fields. Re-enable the feature to restore management access.
