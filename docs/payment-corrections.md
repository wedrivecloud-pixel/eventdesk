# Correcting recorded payments

In a booking, open **Make Payment**, choose **Void payment** on the incorrect
receipt, enter a reason, and confirm. Finance → Payments offers the same action.
Cancel leaves the receipt unchanged. This corrects a recorded receipt; it does
not issue a refund or transfer money.

The original amount, tip, received date, method, reference and creation timestamp
are retained. The correction records the authenticated owner, their display name,
the time and a required reason. A second void request cannot overwrite this audit.
To correct an amount, void the erroneous receipt and record the correct payment.

Effective payments and voided history are separate in the owner snapshot. Balances,
revenue, tips, public proposals and invoices exclude voided receipts. The booking
keeps a **Voided payments** history; Finance has **Show voided payments** and exports
status and correction details. Public proposal responses omit private void notes.

## Deployment and rollback

Apply the additive payment-column migration before serving this code. Existing
receipts default to active. Sites packages the D1 migration with the release; the
public-launch checkout has a separate PostgreSQL migration for its migration runner.
No production receipt is changed by migration.

Once any payment has been voided, do not roll back to application code that counts
all payment rows: it would count voided receipts again. Retain the effective-payment
filters when rolling back UI changes, or fix forward. Do not delete void records
or reverse their audit fields as a rollback procedure.

## Verification

`node tests/payment-voids.mjs` uses an isolated database with real routes and store:
migration defaults, authentication, origin check, tenant/event/payment scope,
reason validation, concurrent requests, immutable audit, balances, tips, revenue,
public invoice data, and replacement payment limits. Existing booking creation,
overview and sales-report regressions also pass.

Local browser QA uses synthetic receipts only. Verified Finance and booking entry
points, cancel, disabled empty confirmation, nested dialogs, corrected balance,
history after reload, and mobile layout. No live user payment was voided by QA.

Public-launch verification: run `node node_modules/tsx/dist/cli.mjs --test tests/platform/payment-voids.test.ts` for the PostgreSQL migration and actual void helper, including tenant scope and preserved audit history.
