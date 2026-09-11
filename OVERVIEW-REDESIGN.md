# EventDesk Overview redesign

The Overview now starts with daily work instead of a full-width financial chart. Its own visual direction uses a compact heading, deep ink navigation, teal actions, a continuous four-metric summary strip, an attention queue, and event cards with date rails and segmented preparation indicators. Existing pages and business records retain their workflows.

## Daily work

- Collected this month: recorded payments in the current calendar month, excluding tips, using the existing revenue rules. Opens Payments.
- Outstanding balance: unpaid amounts on active confirmed and postponed confirmed bookings. Opens the exact matching records.
- Next 30 days: active confirmed bookings from today through day 29. Opens that exact date window.
- Requests to approve: active online booking requests still marked for review and not confirmed. Opening one never confirms it or reserves the date.
- Needs Your Attention: past-due payments, requests, uncovered deposits, due follow-ups, leads without a next contact date, expired/soon-expiring proposals, and preparation gaps for events in the next 30 days. The total counts actionable items, so one event may have several. It does not infer email response status while delivery is unconnected.
- Open Proposals: potential booking value, client, event date, expiration, and follow-up. Opens the existing record or proposal workspace.

## Event preparation

Indicators link to the relevant existing booking tab. Payment checks cover overdue amounts and the requested deposit; staff uses configured requirements and active assigned profiles. Questionnaire completion requires finalization and all visible required answers, ignoring content-only and hidden conditional fields. Checklist progress excludes tasks explicitly due after the event. Unassigned questionnaires/checklists and undefined staff requirements are labeled as unset, not complete. These indicators describe saved setup; they do not guarantee equipment availability or staff calendar availability.

Upcoming bookings can show the next 7 days, next 30 days, or all future bookings. Recently Booked and existing messages, leads, payments, follow-ups, and services remain available. Empty lists collapse to expandable rows by default; all widgets retain show/hide, result limits, and ordering. Width choices now refer to a sequential responsive grid. Quick Actions & Tools always stays in the header and can be hidden.

## Revenue and preferences

Revenue defaults to collected payments for This month with a previous-month comparison. A user can save a preferred basis, date range, grouping, and comparison toggle through Save as my default. Whole calendar month/year comparisons use the preceding month/year; month-to-date/year-to-date clamp missing month days. Other rolling/custom periods use preceding periods of equal duration; multi-month calendar ranges use the same number of prior months. Actual comparison dates are always shown, and a zero baseline does not manufacture a percentage.

Saved redesign settings use separate account payload fields (`overview`, `overviewRevenue`) from the version 20 `dashboard` field. No database schema or record migration was introduced. Version 20 remains the saved pre-redesign Site, with its legacy layout intact. Restoring a website version does not revert business records.

## Validation

Focused tests cover priorities and ordering, request review semantics, lifecycle exclusions, exact summary totals, conditional questionnaires, post-event tasks, date boundaries/comparisons, legacy layout compatibility, and lack of source-data mutation. In-memory account/API tests cover persistence, business isolation, invalid/stale writes, profile preservation, and preservation of the original dashboard settings. Browser checks use the existing local sample data and do not save business fixtures or send messages.
