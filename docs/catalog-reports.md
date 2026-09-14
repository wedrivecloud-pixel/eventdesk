# Catalog reports

Reports now offers separate Packages, Add-ons and Backdrops cards and tabs.
The existing Packages & Add-ons report remains readable for saved reports.

- Packages: service, package group and Public/Private/Disabled status filters.
  Columns include scheduling mode, hour/day duration, unit pricing, tax,
  extra-time rates, deposit rule and required backdrop configuration.
- Add-ons and Backdrops: category and Active/Archived filters. Defaults show
  active items. Optional columns include description, lead time and gallery
  setting. Add-ons also expose quantity and pricing multiplier settings.
- Name, status, price and catalog position sorting; selectable columns;
  CSV uses selected columns and existing formula-injection escaping.
- Save report preserves filters and columns. Category IDs are validated against
  the signed-in business and correct resource kind. Existing report permissions
  and tenant-scoped data loading are unchanged.
- Active item titles open the existing catalog editors. Archived extras remain
  readable in reports and can be restored from their catalog manager. No writes happen merely
  by viewing, filtering, exporting or opening a report.

These are current catalog configuration reports, not sales revenue reports.
Package base prices are stored in cents; extra prices and configuration rates
are stored in dollars. Percentage deposits stay percentages rather than being
shown as a fabricated fixed amount. Date filters are intentionally omitted.
Inherited backdrop price/lead-time values use the same active-category resolver
as booking quotes. Gallery columns show the saved setting; category/package
visibility rules still determine whether a customer can see the item.

Validation: `node tests/catalog-reports.mjs`, existing sales and availability
report tests, TypeScript checks, and local browser checks of report navigation,
filters, columns, saved-report persistence and catalog editor links.
No schema or data migration. The public-launch implementation uses the same
report logic while retaining its PostgreSQL adapter and /app entry route.
