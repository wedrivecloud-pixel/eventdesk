# Proposal client selection

Creating a proposal now offers name/email search and an **Add new client** action. Selecting a result fills name, email and phone. Those fields remain editable. Entering a known email identifies the existing contact and offers to reuse saved details. Nothing is written until the proposal is saved.

The directory uses the authenticated CRM snapshot, including past event contacts and unarchived customer-role resources. Global search and the proposal picker share `lib/clients.ts`. Email is trimmed and compared case-insensitively; punctuation and plus-addressing are preserved. Distinct emails with the same name remain separate. The latest updated event supplies contact details, while previous event snapshots remain unchanged. Deleted and spam events are excluded.

This uses the existing event-based contact model. It does not create a login, send an invitation, introduce a client table, or update other events. Multiple people using one email share its contact history, as in existing global search. There is no schema migration or provider-specific SQL for this feature. Existing event edits, leads, bookings and public booking forms retain their current fields.

## Validation

- `tests/global-search.mjs`: directory deduplication, distinct/plus addresses, latest contact values, previous names, customer roles, lifecycle filtering and snapshot isolation; existing global search cases also pass.
- `tests/browser/proposal-client-picker.spec.ts`: name/email search, duplicate entries, namesakes, keyboard selection, clearing stale phone values, matching an email entered manually, existing/new client proposal saves, saved contact reuse and preserved historical details. Desktop and 390px mobile checks; synthetic fixtures cleaned up afterward.
- TypeScript and production builds checked for both the Sites beta and future Railway sources.

Run browser QA locally against the beta with `QA_BASE_URL=http://localhost:3000` and `QA_AUTH_MODE=sites-local`; the test rejects non-loopback hosts in this mode. For the future Railway build use the synthetic QA account with `SEED_SYNTHETIC_DATA=true` and the configured seed password. No publication is performed by the test.

Status: available in local preview; not published.
