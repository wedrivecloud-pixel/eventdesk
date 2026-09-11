# Package Manager comparison

Compared on September 5, 2026 with the signed-in Check Cherry Package Manager, its service/group/package menus, New menu, bulk table and settings dialog, service/group editors, ordering page, deletion confirmation, and every conditional section on Package Pricing & Scheduling. Reference data was read only. Destructive actions and booking submissions were exercised only on localhost sample fixtures.

| Reference capability | EventDesk result |
| --- | --- |
| New service, package group, package | Available; empty services/groups remain manageable and searchable. |
| Bulk Edit Package Settings | Fixed entry point: opens a dedicated table before selection. Individual, group and service selection; select shown up to 100 packages. |
| Bulk status, move group, price | Available, including fixed price and positive/negative adjustments. |
| Bulk taxability, extra-hour pricing, deposits | Added. Flat/percentage/none/business-default deposits; unchanged fields retain their values. |
| Bulk scheduling and availability | Added date/time modes, slot modes, configured start times, weekdays and hours. |
| Bulk advanced | Added title/subheader, request type, notice, staff count, backdrop settings and included extras. |
| Bulk delete | Added typed confirmation and server validation. |
| Service menu | Edit, Duplicate Service, Set Visibility of Packages, Delete Service, Reorder Services, Reorder Package Groups, Shareable link to service. |
| Group menu | Edit, Duplicate Package Group, Set Visibility, Delete, Move to Service, Reorder Groups, Reorder Packages, Shareable group link. |
| Package menu | Edit, Duplicate, Visibility, Move to Group, Delete, Shareable link. Disable/restore also available. |
| Service/group duplication | Copies packages, presentation, groups (including empty groups), sort order and photos. New packages are Private. |
| Visibility | Public, Private/unlisted and Disabled. Service/group changes include packages hidden by the current filter. |
| Deletion | Explicit typed confirmation. Removes catalog records/images, preserves existing event/quote snapshots. |
| Ordering | Saved service/group order and automatic price/name/custom package order. Uses accessible up/down controls instead of drag-and-drop. |
| Service/group booking-page presentation | Name toggle, subheader, primary-image upload/removal, rendered on the catalog. |
| Package images and editors | General, Pricing & Scheduling, Advanced; primary/gallery upload/removal, direct booking page. |
| Package scheduling | Date & Time with Minimal, Automatic Slots (separate Slot Interval), or editable Predefined Slots (start/end, label, weekdays). Date Only uses an inclusive start/end date range. |
| Package pricing | Starting rate, hours/minutes or days included, extra hourly/daily rates, minimum/maximum length, booking increment, per-unit/range tiers with included units, and deposit options. |
| Package availability | Every day, limited earliest/latest starts, or individual weekday hours. New rules constrain event starts; old event-fit windows remain unchanged until edited. |
| Share links and QR | Full catalog, service, group, individual package; copy link, HTML link and downloadable QR. |
| Booking approval | Client requests create leads for owner approval. No date reservation, payment or email is triggered. |

## Remaining differences found

These are recorded explicitly, not represented as working controls:

- **Service location policies:** Check Cherry offers address collection modes, preferred-location selection, venue/location/property labels and a skip-location setting. EventDesk currently collects an optional free-text venue. These policies are not yet connected to its client flow.
- **Staff assignment modes:** staff title, customer-selected staff, automatic assignment, staff requests and staff claiming are not equivalent to EventDesk's current owner-assigned roster. Staff login/permissions and staff-specific availability are not implemented.
- **Delayed group pricing:** Check Cherry can hide pricing until lead details are collected. EventDesk currently displays catalog starting prices and an estimate before booking submission.
- **Media tools:** direct uploads work, but Check Cherry's shared media library and cropping tools are not included. Collection images appear in the public catalog; a separate proposal-image selection workflow is not included.
- **Package content:** descriptions are plain text; rich-text editing is not included.
- **Pricing compatibility:** old whole-package unit multipliers, line-price deposit percentages, date-only hourly durations and event-fit windows remain available for existing packages. New package defaults use additive unit tiers, booking-total percentage deposits and earliest/latest start limits. The editor makes conversion explicit.
- **Save behavior:** package sections save the complete package draft together. Slot and tier dialogs apply to that draft; a package save persists them. Quantity is capped at 100,000 per request, date ranges at 365 days, slots at 40 and tiers at 30.
- **Presentation/workflow differences:** ordering uses buttons rather than drag-and-drop. Vendor-specific expert setup appointments, help center and support chat are not reproduced. Booking modes route requests for approval rather than automatic checkout.
- **Sharing:** service/group URLs use their current names; copy a fresh link after renaming or moving them. Individual package URLs use stable package IDs. The site's current owner-only access must be changed with explicit approval before external clients can visit any booking page.

## Verification

- Pricing/scheduling tests: additive per-unit and flat range arithmetic, included units, taxed deposits, legacy rate preservation, exact slot duration/weekday checks, independent slot intervals, latest-start semantics, full day-range blackouts, immutable quotes, approval-only requests and atomic overlapping-range capacity.
- Local action tests: all bulk updates validated before writes; invalid batches/foreign IDs rejected without partial changes; custom ordering and empty groups copied; independent package photos remain usable after source deletion; immutable collection-image references survive source removal; correct public service/group filtering; malformed scope rejection; mixed taxable quote math and unchanged quote history.
- Existing package, catalog, link, anonymous-booking and tenant-isolation checks passed. Original workflow and management checks passed with isolated pricing/availability fixtures; the capacity fixture now uses an unused event date.
- Browser: Bulk Edit opened with no selection, selection enabled editing, a flat deposit change saved, and a QR code rendered. Service/group menus and confirmation flows checked separately. Production build and TypeScript validation required before publication.

No Check Cherry records or hosted EventDesk customer records were used for mutation tests.

Reference: [Check Cherry package settings](https://www.checkcherry.com/help/187-package-settings). The signed-in form was also inspected without saving changes.
