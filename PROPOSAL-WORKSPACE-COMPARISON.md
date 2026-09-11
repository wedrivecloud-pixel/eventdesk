# Proposal workspace comparison

Reference reviewed read-only in the owner's signed-in Check Cherry browser on September 7, 2026: `https://sipovac-photobooth.checkcherry.com/events/666125-lisa-tom-rodriguez-s-proposal-sample`, its eight tabs, email composer, attachment form, and client preview. No reference records were changed or messages sent.

The screenshot labels the requested payment tab **Make Payment**, alongside a separate **Invoice** tab. EventDesk now uses those eight tab labels while keeping its own visual design and sidebar navigation. The workspace also serves confirmed bookings, retaining confirmation/reopening and existing financial history.

| Area | Implemented in this update | Limits / remaining reference differences |
| --- | --- | --- |
| Overview | Packages, descriptions and available package images, quote adjustments/add-ons, venue, private notes, original client submission, client details, payment summary, follow-up/source, staff assignment, confirm/reopen, and sharing controls. | No proposal alternatives, additional-contact account assignment, delivery/view tracking, or client e-signature capture. Existing event editor manages packages, venue and quote. |
| Send Email | Opens a prefilled, event-linked draft with recipient, subject and client proposal URL. Existing template, attachment and review tools are reused. | User chose drafts/review only. This never sends an email; saving stores a draft. |
| Copy Link | Stable, random 256-bit capability per event; clipboard confirmation and selectable fallback URL. Owner can disable the link; next copy generates a new one. | Hosting access still applies. The site audience is not broadened by creating a link. Link holders with site access can view client-visible proposal data; this is not a separate client account. |
| Preview | Proposal and invoice views, brand/theme, intro, pricing title, about/reviews/gallery, business footer, terms, totals and print/save-PDF. | Read-only document; acceptance and payment are arranged with the business. Client checklist/design/questionnaire editing and electronic signing remain separate work. |
| Checklists | Checklist-only template chooser, grouped saved tasks, completion, ad hoc task with due date, and confirmed reset of completion. | No separate event checklist print view or per-checklist public links. |
| Designs | Matching design collections can be added before confirmation; existing collection/layout/question/selection tools remain available. | Full customer design approval workflow and share links remain unconnected. |
| Questionnaires | Questionnaire-only template chooser, existing question types/responses, save and finalize. | No per-questionnaire customer portal link or print view added. |
| Make Payment | Payment plan selection, received-payment history, balance, manual receipt with tip/date/method/reference, existing backend amount validation. | Payment processor decision remains deferred. No charge, refund, transfer or receipt email occurs. |
| Invoice | Editable invoice/PO number, issue/due dates, recipient/email/public notes; line items, discount/tax/travel, deposit, payments, balance, payment schedule and print/PDF. | Existing event editor manages priced line items. No arbitrary standalone invoice line editor, expense editor within invoice, or tax/accounting integration. |
| Attachments | Named document upload (PDF/PNG/JPEG up to 5 MB), website links, edit name/link/customer/staff visibility, remove with confirmation, owner/private default, protected downloads. | Up to 30 active attachments per event. Removal archives metadata and access, retaining stored bytes. Media-library selection is available in message drafts, not the event attachment form. Staff flags are retained for the future staff sign-in workflow. |
| Messages | Event-scoped drafts, review stages, scheduled-draft list, manually logged history, template composer and message attachments. | No email/text delivery, provider-verified history, threaded provider inbox or bounce tracking. |

## Data and access

- Reuses existing event operations, business-scoped sales records and R2 storage; no schema migration or dependency changes.
- Invoice/task/attachment updates protect against stale edits. Invoice and task saves preserve unrelated operations.
- Public documents use an explicit data allowlist. Private notes, staff, internal drafts, quote rules and payment references do not enter the client document.
- Shared links are event-specific and can be revoked. Archived/inactive events cannot be accessed by token. Gallery images must belong to the same business and be selected in the proposal. Customer attachment downloads require both a valid event link and customer visibility.
- Online requests still require owner approval, and online processing and delivery remain deferred per user choices.

## Validation

- `tests/proposal-workspace.mjs` passes using isolated in-memory SQL/R2/auth fixtures: owner isolation, wrong/absent/revoked tokens, stable link reuse and regeneration, invoice/checklist persistence and stale edits, client-data exclusion, draft-only state validation, upload type/size rejection, attachment visibility/download/removal, generic archive bypass prevention and selected-gallery access.
- TypeScript check passes. Browser review covered all eight tabs, invoice edit fields, attachment kind forms, questionnaire responses, payment history, prefilled email recipient/subject/link, clipboard success, and client preview.
- Browser testing used an existing localhost sample proposal. No emails, payments, confirmation or hosted customer-record writes were performed. The temporary local sharing link remains pending cleanup approval after automatic UI review rejected its revocation; isolated tests verified revocation behavior without changing hosted access.
- The prior published source checkpoint is `c43cbd59d2bd51ad6c1c810345c285c73057f1a1` (version 23), which can be restored independently of these source changes.
