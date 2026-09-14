# Most Frequently Booked

Reports → Most Frequently Booked exposes Packages, Add-ons, Backdrops, Staff and Customers as tabs. The existing Referrers view remains available. Opening from the library defaults to the current business-local calendar year; saved reports retain their date range.

Active confirmed bookings are grouped by scheduled start date. Package and extra IDs remain stable across renames; customer emails are trimmed and case-normalized. Missing emails remain separate by booking. Counts are distinct bookings, while add-on quantities sum saved quantities. Values sum saved line amounts once, without multiplying already-totaled prices by quantity. Customer totals include tax and adjustments. Staff shows counts without a misleading zero revenue column. Archived catalog identities can still appear in historical results.

Every result opens a booking list. Columns, dates, group and search persist in saved reports, and CSV uses the selected columns. Existing business-scoped snapshots, authorization and booking records are unchanged. No schema or data migration is required.

Validated with frequency regression tests, existing report suites, TypeScript and a production build. Frequency tests cover renames, repeated extras, quantities and zero-priced inclusions, customer normalization, staff deduplication, dates, search, columns and drill-down IDs.
