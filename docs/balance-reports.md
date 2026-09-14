# Outstanding Balances and Scheduled Payments

Reporting has two visible entries and shared tabs. The legacy Balances report remains available to saved reports, with its original behavior. New views default to active confirmed bookings. Proposals can be selected separately; leads and inactive bookings are excluded. Permissions and business scoping continue to use the existing reporting payload.

Outstanding Balances shows the next unpaid due date, event/client/venue, deposit outstanding, booking total, recorded payments, balance and days past due. Scheduled Payments shows unpaid saved installments and a final balance for any portion of the current quote not covered by the saved plan. Auto pay is explicitly not connected.

Payments have no installment assignment, so non-voided principal payments are allocated in due-date order before filtering. Tips do not reduce balances. Saved schedules are capped at the current booking total; quote increases beyond the plan become a final balance. No dates are invented for deposits without a saved plan. Fully paid installments and bookings are excluded. Days past due use the business time zone.

Both views support event-date and due-date ranges, search (including client contact), service, proposal/confirmed status, payment-plan presence, due status, amount limits, sorting, selectable columns, saved reports and CSV export. Scheduled Payments also filters by scheduled installment or final balance. Amount limits use remaining amounts, and summary totals reflect all matching rows. Event links open the existing booking detail view.

`node tests/balance-reports.mjs` verifies partial allocation before filtering, voided payments and tips, lifecycle exclusion, date boundaries, overdue/today filters, overpayments, quote changes, no-plan fallback, totals and columns. No migration or live payment changes are required.
