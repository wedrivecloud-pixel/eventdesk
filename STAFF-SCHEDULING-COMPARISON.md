# Staff accounts and appointment scheduling comparison

Inspected September 6, 2026 in the user's signed-in Check Cherry account. This update addresses Staff & user accounts; the Design Collections work remains intact.

Reference screens inspected without saving changes:

- User roster and staff profile: `/admin/users` and `/admin/users/417957-dan-sipovac`.
- Staff Booking Availability: `/admin/users/417957-dan-sipovac/availability`, including the partial-day and weekly-hours controls.
- Appointment Scheduling: `/users/417957-dan-sipovac/user_appointment_calendars`, including its actions menu.
- Default calendar Overview, Scheduling, Meeting Details, and Questions tabs, plus question label/hint editing and the question sample library.
- Client scheduler: `/schedule/417957-dan-sipovac/10868-default`, including selection of an available time and the intake form. No appointment submitted to Check Cherry.

| Reference feature | EventDesk behavior |
| --- | --- |
| Staff profile and account summary | View profile & scheduling in Manage → User accounts; overview, availability, appointment calendars, assigned schedule. Existing account editor and role filters remain available. |
| Weekly booking availability | Seven days, all day / certain hours / unavailable, earliest start and latest end. Checked when confirming events or assigning staff to confirmed events. |
| Staff time off | Add/edit/remove, start/end dates, all-day or start/end times, reason, approval state, show past time off. |
| Multiple appointment calendars | Create, edit, duplicate, reorder, pause/enable, delete, preview, per-calendar and per-staff sharing links with copy and QR tools. Deletion retains appointment history. |
| Appointment scheduling rules | Appointment length, buffer between appointments, minimum notice, maximum days ahead or no limit. Independent weekly hours or shared booking hours. |
| Conflict choices | None / assigned bookings / all bookings; none / staff time off / all business blackout dates. Scheduled appointments for the same host always prevent overlap. |
| Meeting details | In person, phone and other; call direction, meeting label/details, invitation and confirmation messages. Confirmation text/details are recorded when approved for owner review and sharing. |
| Intake questions | Required location/name/email; optional phone, guest emails (maximum five), notes; editable labels/hints, required/optional, ordering, sample questions and custom text, long text, date, time, number and dropdown questions. A phone number is required when the host will call the invitee. |
| Client scheduling | Calendar/date/time selection, business timezone, configured intake form, pending request receipt. Server derives duration, host and status from the calendar. |
| Approval workflow | Public requests remain Pending without reserving the slot. Approve/decline in Sales → Appointments. Approval rechecks conflicts inside the database write; competing approvals cannot reserve the same staff time. Restored archived appointments return Pending. |

Intentional boundaries:

- New requests require approval, matching the user's preference. Check Cherry's immediate-confirmation text is not used for a pending request.
- Zoom/Google Calendar/Google Meet connections and email/SMS delivery remain disconnected. Manual meeting details and video URLs can be recorded. No mock connection or delivery-success controls were added.
- Existing owner-private Sites access remains unchanged. Share links are functional within that audience; external clients need site access before using them.
- Staff records do not grant separate logins or send account invitations. Calendar invitations and external calendar feeds are not connected.
- Invitation/confirmation messages use plain text; rich text formatting is not part of this update.

Validation: TypeScript, production build, staff scheduling tests (weekly/overnight boundaries, partial-day time off, DST gaps, notice/future limits, conflict policy choices, persistence, intake validation, competing approvals, archive restore and public data projection), existing Sales regression suite, management unit tests, and read-only browser review of the EventDesk profile, availability, calendar editor and question controls. The client route and saved calendars were exercised by local API tests. Automatic approval review blocked a later browser save of a temporary QA calendar; that save was not retried.
