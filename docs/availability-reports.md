# Blockouts and staff reports

Open **Reports** and choose **Business Blockout Dates**, **Staff Time Off**, or **Staff Availability**. The report tabs switch among these three views. Existing saved **Blockouts & Availability** reports keep their combined output.

- Business Blockout Dates reads the existing Availability settings. Dates are all-day and deduplicated. Reasons and creation dates are not stored by this settings model and are not invented in the report.
- Staff Time Off reads non-archived time-off records, including historical records for archived staff. It shows the staff member, start/end (including times for partial days), all-day flag, reason, approval status and entered timestamp. Event-date filters include overlapping ranges, not only records starting within the range. Entered-date filters and timestamps use the business time zone. Only approved time off affects assignments.
- Staff Availability reads active staff's saved `bookingAvailability` weekly pattern. Columns show Sunday–Saturday with all-day, unavailable or specific hours. The scheduling engine's existing default is all-day when no custom week is saved. Invalid legacy schedules show **Needs review** rather than claiming availability. This is a recurring schedule report, not a guarantee of availability for a specific event; time off, bookings and appointments still apply.

Search, staff/status filters, sorting and column selection apply to displayed rows and CSV exports. Save report preserves these options. At least one column remains visible. Reversed date ranges show an error and cannot be exported or saved. Changing report tabs starts a fresh set of filters. Weekly schedules do not use date filters. Manage buttons open the existing settings or staff availability tools.

No new database tables, booking rules or permissions are introduced. Data still comes from the authenticated business snapshot. Saving a staff filter validates business ownership, including archived staff for historical reports. CSV uses the existing spreadsheet-formula escaping.

Reference inspected read-only: Check Cherry `/report/business_blockout_dates`, `/report/time_off` and `/report/staff_availability`, including report filters. Eventdeskly uses explicit date ranges rather than the reference's relative date presets.

Validation: `node tests/availability-reports.mjs` covers actual report builders and saved-report validation; `node tests/sales-reports.mjs` checks existing report calculations and CSV behavior. Rollback can redeploy the previous version; no stored records are changed by viewing these reports.
