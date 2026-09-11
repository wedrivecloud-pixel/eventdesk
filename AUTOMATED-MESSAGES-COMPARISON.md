# Automated Messages comparison — September 6, 2026

## Prefilled messages update — September 9, 2026

Compared the live Automated Messages page and the expanded admin/customer booking confirmations and payment reminder with the supplied screenshot. The previous EventDesk implementation had a starter library, but Add Message opened a blank editor and the booking starters omitted most of the event summary.

- Added 35 original, purpose-specific prefilled messages covering all 29 supported triggers. Trigger groups expose the relevant starters with recipients, timing, reply settings, conditions and expandable message text. Browse Templates also searches subjects and bodies.
- Add Message now opens with a complete starter subject and body. Use Template opens the selected starter with its recipient and timing settings. New rules start paused. No existing saved template is overwritten or automatically installed.
- Existing messages can explicitly replace their subject and body from a matching starter; recipients, timing, conditions and other edits remain intact. Selecting an option alone does not replace text.
- Admin/customer booking confirmations now include package descriptions and duration, add-ons with quantities and descriptions, backdrop, venue address, total, coupon, retainer remaining, balance, payment due date, event/invoice links and business signature. The template is visible before choosing a preview record.
- Rendering prefers the booking's saved package/add-on descriptions, uses the structured booking address only while it still matches the event, respects invoice due-date overrides, and reads the configured business signature. Empty optional selections are described explicitly.
- Existing, active client links populate from the current page/request origin. No link or access token is created by previewing. Missing/revoked links remain unresolved; create/copy a client link in the booking or proposal and reopen the preview. Generated links never use a template-supplied origin. Server-side record values override optional manual preview values.
- Specific payment/refund/installment amounts and dates still require explicit draft values when the exact triggering transaction is not selected. The app does not guess from the last payment. Online payment links are not advertised while payment processing is disconnected.

Validation: expanded reference and local template details; Use Template and Add Message prefills; editing and switching tabs; deliberate subject/body replacement; template search; no browser console errors. TypeScript, the production build, messages unit tests and local messages API tests pass. New tests cover starter coverage/validation, copy isolation, all confirmation tokens, snapshot preservation, saved addresses, signature/due-date values, missing/invalid/revoked links, request-origin link generation, draft persistence, and server precedence over manual values. Existing unrelated lint diagnostics remain in these older message modules; the touched template callback is no longer named like a React hook. No email or SMS was sent.

Reference inspected while signed in, without saving changes: `/admin/automated_events` (both pages), `/new`, Booked Date `/new_step2`, `/442085` preview, `/browse_templates`, `/admin/custom_templates`, `/442104/edit`, `/admin/system_templates` and `/442101/edit`.

## Implemented

| Reference workflow | EventDesk behavior |
| --- | --- |
| Automated Messages / Custom Templates / System Templates navigation | Three working tabs under Manage → Automated messages and Message templates. |
| Booked Date and other trigger groups | All 29 observed trigger choices, grouped list, empty-group visibility, per-group Add, and category chooser. |
| Booked Date timing | When, After, Manual; minute/hour/day/week/month/year offsets. Scheduled-date triggers also offer Before. A secured booking timestamp is distinct from lead creation and event date. |
| Custom templates | Booking, proposal, lead and appointment categories; new, edit, preview, duplicate, archive/restore and delete. |
| System templates | All 11 observed purposes, including Email/SMS gallery/proposal/design variants, customer/staff invitation, design approved/revision/selection. Original EventDesk wording. Business-specific overrides; fixed name/channel/category; restore defaults. |
| Browse Templates | Original starter library, searchable by name and trigger, category/channel filters, detail preview and Use Template. |
| Editor | Description, Email/SMS draft type, multiple recipient roles, explicit additional addresses, reply preference/custom reply email, subject, body, tags, protected attachments, package scope, conditions and future review preference. |
| Live Preview | Select a matching booking/proposal/lead/appointment, preview recipient-specific values, show planned timing in the business time zone, show matching conditions and missing values. |
| Dynamic values | Booked date, event/client/business/package/balance values and appointment fields. Unsupported or unrecorded values remain visibly unresolved and must be filled in for a draft. No invented invitation, proposal, design or gallery links. |
| Review Messages | Explicit preparation creates owner-only Sales → Messages → Awaiting Review records. Recipients are resolved server-side; attachment ownership and package scope are enforced. Batch creation is atomic and request retries are idempotent. |

## Deliberate limits

Delivery and background scheduling remain disconnected per the user's instruction. Enabling a rule only permits manual draft preparation. The review-before-sending checkbox stores a future preference; it cannot bypass review or send anything. System templates customize drafts; they do not activate portal invitations, a design approval service, gallery hosting or payment processors.

The message body is plain text; Check Cherry's rich HTML editor is not reproduced. EventDesk starter wording is original, not a copy of Check Cherry's full proprietary template library. Some activity timestamps (for example first view, staff removal and failed automatic payment), referral attribution and upload actor data are not recorded. Their trigger configurations are saved, but preview explicitly reports missing timestamps or nonmatching unrecorded conditions. Users can supply an actual trigger time for a draft preview. Old confirmed records without a secured timestamp are not assigned a fabricated booked date. Date-only payment/expiration previews use midnight in the business time zone.

## Validation

- Browser: all three tabs; Booked Date When/After/Manual choices; conditional amount/unit fields; paused-rule save/reopen; menu actions; system-template catalog; visual layout.
- `tests/messages-unit.mjs`: every starter validates, 29 triggers/11 system templates, secured versus created timestamps, legacy aliases, DST and month/year offsets, conditions, matching record categories, recipient resolution and unresolved tokens.
- `tests/messages-api.mjs`: local fixture CRUD/duplicate for paused rules, invalid timing and foreign-scope rejection, preserved confirmation time after event edits, Email/SMS drafts, personalized recipients, duplicate-request protection, unresolved links, business ownership, system override persistence and default restoration.
- `tests/manage-unit.mjs`: existing pricing, scope, quantity, snapshot and template synchronization regression checks.

An automatic approval review rejected saving an enabled UI test automation. The test rule was changed to paused and saved successfully. Tests used the local Sample Event Studio only. Temporary catalog/message resources were removed, temporary sales records archived, and test events marked Deleted. No Check Cherry records were changed and no email/SMS was sent.
