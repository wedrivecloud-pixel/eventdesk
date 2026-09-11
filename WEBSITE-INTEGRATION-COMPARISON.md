# Website Integration comparison

Compared the signed-in Check Cherry integration page and each Get Embed Code dialog on September 6, 2026: https://sipovac-photobooth.checkcherry.com/admin/integrations. Reference account inspected without saving or changing records.

| Reference tool | EventDesk implementation |
| --- | --- |
| Book Online | Business-specific package catalog; Link Only, Customized Link and Button styles; text, colors, font and radius; preview, copy and QR code for links. |
| Link to a specific package | Service, package-group and individual-package selection; public packages by default, optional private packages; direct package booking page rather than a generic catalog. Same link/button builder. |
| Sign In | Visible integration card and link/button builder for a connected HTTPS customer portal. Customer accounts are not connected in this version. No business workspace login is presented as customer sign-in. |
| Lead Forms | Existing contact-form selector and management shortcut; link and embedded form; compatibility iframe; wide buttons, placeholders for text fields, label appearance, font, width, input background, borders and button colors. Date/time/select labels remain visible. Custom-question labels remain visible. |
| Add-on Gallery | Link/embed, booking button/text, prices, all or selected categories, package preselection, colors, font, width and pagination. |
| Backdrop Gallery | Link/embed, booking button/text, titles, prices, selected categories, font/colors, maximum items per page and package preselection. |
| Design Template Gallery | Link/embed, selected collections, booking button, tag viewer, colors and package preselection. Public layout presets render their diagrams. |
| Staff Profiles | Link/embed for staff explicitly enabled for the public gallery. Optional booking button. Private email, pay and staffing details are excluded from gallery data. |
| Booking Availability Calendar | Link/embed, date picker/calendar, package selection/filter, custom available/unavailable messages, optional/custom-destination booking button. Checks the existing availability API and carries the selected date into the package request form. |
| Appointment Scheduler | Link/embed, staff with active scheduling calendars, individual/all-calendar selector and staff-management shortcut. Embeds the existing approval-based scheduler. |
| Mini Sessions | Visible card and link/button builder for an existing HTTPS mini-session destination. Mini-session checkout is not connected in this version. |

All actual embedded tools offer a standard script embed with automatic height adjustment and a compatibility option using a fixed-height iframe. Both include an open-page fallback. The builder includes live preview, generated code and a downloadable guide for a web designer. Customizations are carried in the copied URL/code; changing them requires copying the updated code to the website.

## Access and remaining differences

- EventDesk remains owner-private. External clients and web designers cannot use hosted links or embeds until the site's audience is deliberately configured. This update does not change audience, payments or messaging connections.
- Customer portal and mini-session workflows still require a connected destination. Their cards do not generate fake internal routes.
- Check Cherry offers a tokenized public integration-guide URL for a web designer. EventDesk provides a per-tool downloadable guide; it does not add a public sharing token or expose the entire business catalog through a new guide route.
- Booking availability checks the chosen package/date rather than promising a reserved date. Booking and appointment submissions continue to require owner approval.
- Appointment calendars and contact forms must be created in their management screens before their embeds can be generated. Empty states provide the corresponding setup shortcut.

## Validation

- `npx tsc --noEmit` and production build.
- `node tests/website-integration.mjs --local`: all destinations and link styles, escaping and option validation, category and package visibility, private staff-data exclusion, design tags, real form/scheduler component rendering with in-memory props, iframe compatibility, multiple embeds and resize-source/origin isolation. Read-only local route/API checks cover galleries, filters, invalid scopes, availability and date handoff. No business test records created.
- `node tests/manage-unit.mjs`: existing pricing, scope, typed questions and template behavior.
- Browser comparison of every reference integration dialog; EventDesk checks include link/button customization, gallery toggles and live preview, package selection, setup states and availability navigation.

Build reports Vinext's duplicate emitted `manage.css` filename warning; the build completes. Browser verification checks the resulting styles.
