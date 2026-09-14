# Daily utilization reports

Reports → Utilization now shows Packages, Add-ons, Backdrops, Bundles and Staff for one business-local date. The former start-date summary remains supported for previously saved `Utilization` reports; new reports are saved as `Daily Utilization`.

- Counts include active confirmed bookings whose occupied window overlaps the day, including overnight and multi-day events. Endpoints are half-open so an event ending at midnight does not reserve the next day.
- Packages count distinct bookings. Extras sum saved quantities, including included extras. Staff count assigned bookings and confirmed appointments once each.
- Peak concurrent is calculated from overlapping intervals, processing ends before starts at the same time. It is different from the daily total.
- Package limits display active shared inventory rules and their pooled usage across every linked package. Add-on quantity limits apply per booking and must not be represented as inventory capacity. Staff concurrency limit is one; weekly hours and approved time off are shown as context.
- This report is not an availability simulator. Business daily caps, blockout dates, notice requirements and package hours still apply when confirming new bookings. Existing confirmation guards are unchanged.
- Bundles is explicitly labeled as packages with automatically included add-ons. It does not claim support for standalone combinations of packages. Historic counts use booking snapshots, so changing inclusions does not retroactively create a bundle reservation. This follows Check Cherry's documented package-plus-add-on workflow: https://www.checkcherry.com/help/33-can-i-bundle-packages . It is not evidence that Check Cherry's empty Bundle report uses that exact definition.
- Search, column selection, sort, date and tab persist in saved reports. CSV uses the same selected columns and existing spreadsheet-formula escaping. Names open reservation details; bookings open the existing booking view.
- Reports operate on the existing business-scoped snapshot and cannot query another business. No schema migration, new inventory limits, seed data or delivery integrations are introduced.

Validation: utilization unit tests cover overnight and multi-day windows, boundary times, canceled/proposal exclusion, quantities, shared pools, appointments/time off, bundle snapshots, zero-use resources, filters, columns, CSV, saved validation and legacy reports. Existing catalog, availability and sales report suites and TypeScript checks pass.
