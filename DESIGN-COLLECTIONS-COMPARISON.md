# Design Collections comparison

Inspected September 6, 2026. Check Cherry was used read-only; no reference records were saved, synchronized, duplicated, deleted, or uploaded.

Reference collection: https://sipovac-photobooth.checkcherry.com/admin/design_template_categories/11581

| Reference surface | EventDesk implementation |
| --- | --- |
| Design Collections | Collection cards, counts, package association summary, New Design Collection, View Templates, settings/tab shortcuts, duplicate and confirmed deletion |
| Layout Options | Ten standard 2x6 and 4x6 layout templates; functional layout diagrams with optional uploaded primary artwork. Existing named collections and templates are reused without overwriting edits. One-time initialization is scoped to the business. |
| View Templates | Cards/list, search, category/layout filters, new/edit, primary and additional images, HTTPS video references, description, extra search text, package visibility, gallery preference, duplicate/delete and manual order |
| Bulk Actions | Multiple image upload (up to 20 images, 10 MB each), bulk add/remove categories, bulk add/remove layouts, associated package assignment and confirmed template deletion |
| Settings | Name, preview upload/media library, Default/Alphabetically/Date Added sorting, All/Selected/No package scope |
| Categories | Named categories within each collection; add, edit, reorder, remove and template assignment |
| Layouts | Named layout filters within each collection; add, edit, reorder, remove and template assignment. These start empty, as in the reference; Layout Options is the collection name, not a layout filter. |
| Extra Questions | Default optional personalization textbox; instructions, text field, multiline text, dropdown, radio, checkbox group, color, file upload and song fields; labels/hints/required answers; preview, reorder, duplicate, remove and save |
| Sync | Preview of affected upcoming confirmed bookings, explicit selection, add/update and optional confirmed removal. Already synchronized bookings are excluded. Saved design choices, historical selected artwork and answers survive updates. Other collections are untouched. |

Reference pages inspected also include `/edit`, `/design_category_tags` and its `/new` editor, `/design_category_layouts` and its `/new` editor, `/design_template_questions` and its existing question editor, `/prepare_sync` including More Info, the template edit page, `?view=list` with its bulk edit dialog, and `/design_templates/new_bulk`.

## Booking behavior

Matching collections are copied to bookings after owner confirmation. Existing bookings receive them only through the Sync action. The booking's Staff & designs panel supports a choice and the collection's extra questions, including authorized file uploads. Records, metadata, images and answers remain scoped to their business. Catalog deletion retains historical booking copies. This update does not add a separate public customer design-approval portal or send approval emails; delivery remains disconnected as requested earlier.

The layout previews are original functional diagrams, not copies of Check Cherry's image files. Businesses can replace them with their own artwork.

## Validation

- `node tests/design-collections.mjs`: passed. Ten presets, repeat-safe initialization, real date sorting, collection/taxonomy CRUD and ownership checks, bulk scope preserving attachments, duplicate ID remapping, confirmation-only booking attachment, required answers, file upload and ownership validation, answer/selection preservation, repeat sync, collection removal isolation, real media upload and bulk template creation, reload persistence. Only isolated local test records were changed and cleaned up.
- `node tests/checklists.mjs`, `node tests/manage-unit.mjs`, `node tests/questionnaires-api.mjs`: passed.
- `npx tsc --noEmit`: passed.
- Production build: passed.
- Browser inspection: collection cards and ten previews, all six tabs, settings fields, category/layout controls, personalization question, sync preview, bulk selection, six bulk actions and associated-package form verified. Existing reference and business booking settings were not changed for browser QA.

No schema migration or dependency change was required.
