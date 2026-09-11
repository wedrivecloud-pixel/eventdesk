# Checklist templates comparison

Reviewed September 6, 2026 in the signed-in Check Cherry browser, without modifying that account.

Reference categories:

- Equipment: https://sipovac-photobooth.checkcherry.com/admin/checklist_categories/32560/checklist_templates
- Pre-event: https://sipovac-photobooth.checkcherry.com/admin/checklist_categories/32559/checklist_templates
- Post-event: https://sipovac-photobooth.checkcherry.com/admin/checklist_categories/32558/checklist_templates

All three category lists, their settings, the item editor, new-item form, item/category menus and reset confirmation were inspected.

## Included items and timing

- **Equipment Checklist (12):** Backdrop, Batteries, Camera & Cord, Gaffing Tape, iPad, Laptop, Media, Monitor, Power Cords, Power Strip, Printer, Rolling Cart. No automatic due dates.
- **Pre-event Tasks (4):** Confirm venue insurance requirements (3 weeks before); Confirm with client (1 week before); Confirm with Staff member (1 week before); Review customer portal (3 days before).
- **Post-event Tasks (2):** Send handwritten card (2 days after); Upload photos to online gallery (1 day after).

The templates initialize once per independent business when its checklist manager is opened. Existing matching categories/items are retained; subsequent openings do not overwrite edits or resurrect deleted defaults. Each item initially applies to no packages, matching the inspected account. The owner can select all or specific packages through item settings or category bulk package selection.

## Functional coverage

Category navigation; new/edit/duplicate/delete/reorder items and categories; title, notes, category, optional automatic due date, days/weeks/months, before/after event/payment/book date, staff assignment and package scope; category To-do visibility and staff/customer permission settings; explicit synchronization to existing upcoming bookings; category application and reset with confirmation.

Applicable templates attach when a booking is confirmed by the owner. Unapproved requests remain unreserved and receive no automatic checklist. Book-date scheduling uses the confirmation timestamp in the business timezone. Unknown date bases do not invent due dates. Synchronization preserves checked status and identity; reset replaces only the selected category. Booking task displays include category, due date, assignee and notes. The consolidated To-do List respects current category visibility, including legacy copies whose category is resolved from their template.

Category permissions are saved and copied to booking tasks. The current owner-private prototype still has no separate authenticated customer/staff checklist portal; these settings do not enable external access.

## Validation

- `node tests/checklists.mjs`: passed. Covers category/item counts, repeat-safe initialization, original-data preservation, due dates/timezone, scoped creation, duplication and reordering, confirmation attachment, assignment, completion persistence, synchronization, reset isolation, ownership and invalid-input checks. Temporary test resources were removed and test events marked Deleted.
- `node tests/manage-unit.mjs`: passed.
- `node tests/questionnaires-api.mjs`: passed, including all ten sample saves and questionnaire synchronization regression coverage.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Browser: three category tabs and all 18 defaults, reference due dates, edit fields, category actions, bulk preselection and package choices verified. Automatic approval review rejected the browser bulk-save test because it could change booking applicability; that interaction remained read-only and was not retried indirectly.

Deleting a template category preserves existing booking snapshots. Reset is explicit, targets selected upcoming confirmed bookings, and requires typing RESET. Template installation does not update existing bookings or enable message delivery.
