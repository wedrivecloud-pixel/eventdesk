# Proposal discount entry

Implemented September 11, 2026 in the beta source and the public-launch migration source. This change has not been published.

Clients can expand **Have a discount code?** above the proposal totals to enter a code. Applying it collapses the entry field and leaves the applied code, removal action, savings, and updated total visible. **Change discount code** reopens the field. Applying a code saves the recalculated quote, updates the balance and invoice discount label, and keeps the event in proposal status. The existing quoted retainer is preserved unless it exceeds the new total. Confirmed, expired, deleted, and otherwise non-editable proposals do not expose the entry form.

Only discounts explicitly configured with **Customers may redeem on proposals** can be newly redeemed. Existing agreed discounts retain their saved terms. Codes are normalized for case and surrounding spaces. Current expiry, date, package, and redemption-limit rules are enforced on the server within the proposal's business. A concurrent change to a discount or proposal prevents the save.

Each proposal has an **Overview → Client options → Show discount code field** switch. It defaults to off, including older proposals without a saved preference. An explicitly enabled proposal stays enabled. Off hides the entire entry/removal control and prevents client code changes server-side, while keeping an applied discount in the totals and invoice. Other client selections remain editable. The owner can turn it on. The setting changes only that proposal and never reprices it.

## Validation

- Beta: `node tests/proposal-workspace.mjs` passed, including invalid/foreign/disabled/archived/expired/package-restricted codes, redemption exhaustion and races, percentage calculation, saving/removing, invoice labels, saved discount terms, and preventing totals below collected payments.
- Browser: `QA_BASE_URL=http://localhost:3000 QA_AUTH_MODE=sites-local playwright test tests/browser/proposal-discount.spec.ts` passed against the local beta at a 390 × 844 viewport. It exercises an anonymous token link, initially hidden entry, keyboard expansion, invalid entry, normalized application, automatic collapse, reopening an applied code, saved totals, reload persistence, removal, and deleted-link access. It uses and cleans up only its synthetic records.
- Mobile screenshot: `artifacts/proposal-discount-mobile.png` in the migration workspace.
- Visibility regression: the browser test switches off and on through the owner's Overview, reloads the anonymous proposal, and verifies the discount and total survive. `artifacts/proposal-discount-visibility.png` shows the control. API tests cover non-owner denial, malformed and stale updates, preservation of quote/private operations, blocked removal, and a concurrent disable during client save.
- A cold-load regression initially allowed typing before React attached the input handler, leaving Apply disabled. The discount controls now stay disabled until ready; the browser regression then passed.
- Both sources passed TypeScript checks and production builds. Existing framework warnings about chunk size and build tooling remain.

The migration uses PostgreSQL-compatible JSON comparisons. Its browser test is prepared for synthetic Better Auth QA, but this feature has not been exercised on a deployed Railway/PostgreSQL environment. No schema migrations, credentials, live discount settings, or email delivery were changed.

## Manual preview

1. Enable **Customers may redeem on proposals** on a test discount.
2. In the proposal's **Overview → Client options**, enable **Show discount code field**, then open its client preview or shared link.
3. Select **Have a discount code?** above the totals, enter the code, then select **Apply code**.
4. Verify the code, discount, total and balance, then reload.
5. Select **Remove code** and verify the undiscounted total returns.
