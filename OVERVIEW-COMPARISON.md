# Overview comparison

Reference inspected read-only on September 6, 2026: Check Cherry's dashboard and [Classic dashboard widget editor](https://sipovac-photobooth.checkcherry.com/admin/dashboard_templates/16750/dashboard_widgets). No reference account records were modified.

## Standard dashboard

| Reference feature | EventDesk behavior |
| --- | --- |
| Revenue Snapshot | Scheduled, Payment, and Booked tabs; 12 date presets including Custom; Day, Week, Month, Quarter, and Year grouping; stacked chart, totals, exact data table, and CSV export. |
| Upcoming Bookings | Active confirmed bookings ordered by event date/time; package photo when available, packages/services, client contacts, venue, staff, balance, booking date/source, and an expanded list. |
| Recently Booked | Active confirmed bookings ordered by confirmation timestamp, independent of event date; expanded list retains that ordering. Older records use creation date with an explicit label. |
| Booking Manage actions | Open overview, open Payments & Balance, open Staff & designs, edit booking/notes, or open a linked appointment form with client details. |
| Quick Actions Toolbar | Create a lead, proposal, booking, or appointment. Tools includes Check Availability, Check Travel Fees, and Check Tax Rates. |
| Recent Messages | Recorded incoming messages, newest first, and a link to Messages. The empty state explains that delivery is not connected. |
| Recent Leads | Active leads, newest first, with contact information and source; open the record or all leads. |
| Recent Payments | Recorded payment date, amount, method, related booking, and tip when present; open booking payments or all payments. |
| Widget customization | Show/hide, order, full/main/side column, result limits from 1–50, hide empty result widgets, and restore default layout. Saved for the signed-in account within its business. |

The existing pipeline/confirmed summary, follow-ups due, and services remain available as additional widgets. Sidebar navigation remains the primary navigation; duplicate top Sales/Manage menus have not been reintroduced.

## Revenue definitions

Scheduled and Booked use the current quoted totals of active confirmed bookings and postponed confirmed bookings. Each quote is split into recorded payments (capped at the quote), projected balance, postponed balance, and past-due balance, with no overlap. Past due uses cumulative installments due before today, less payments, or the final due date when no installment schedule exists. A payment due today is not overdue.

Payment uses actual recorded cash amounts in the selected payment-date range and excludes tips. Received payments remain collected revenue if the booking was subsequently canceled or archived; deleted/spam records are excluded. Booking count is the number of distinct associated bookings, and average is collected revenue divided by that count. Scheduled/Booked use the number of included bookings. Calculations use integer cents and the business timezone for timestamps. These are current-state reports, not historical account-balance reconstruction.

## Remaining differences

- This update covers the seven standard Classic widgets, plus the three existing EventDesk widgets. Check Cherry's additional optional widget catalog, alternative dashboard templates, and multiple arbitrary layout blocks are not implemented here. EventDesk offers one personal layout with full-width, main, and side areas, using accessible move buttons rather than drag handles.
- Availability checks use the existing package booking rules and capacity endpoint. Staff and additional item selections need separate review. This is not Check Cherry's full simulation across packages, add-ons, backdrops, staff, appointments, and the business. Travel/tax actions open the existing zone settings, matching the reference destinations; they do not claim to calculate an address quote from empty zone data.
- Email/SMS delivery and online payment processing remain unconnected as previously requested. No synthetic messages, payouts, payment transactions, or bookings are created by Overview.
- Legacy bookings without a confirmation timestamp cannot provide an exact original booked date. The UI explicitly labels the creation-date fallback.
- Revenue range/group choices are temporary view filters; widget layout choices persist after Save Dashboard. The Payment tab also permits future ranges, showing only recorded payments in those ranges.

## Verification

- Focused revenue tests cover partial payments, overdue installments, postponed balances, lifecycle exclusions, payment dates, confirmation dates, tips, overpayments, business timezone boundaries, leap/month/year boundaries, all grouping choices, invalid date ranges, and legacy fallback dates.
- In-memory account/API tests verify layout persistence, business isolation, stale-write rejection, validation, and preservation through profile/support-draft updates.
- Local browser checks verify the chart, exact values, Payment/Booked switching, widget visibility/result-limit/reorder controls and Cancel, read-only availability results, and booking payment/appointment shortcuts. No business records were saved for browser QA.
