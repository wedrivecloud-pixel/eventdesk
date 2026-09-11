# User options comparison

Compared the signed-in Check Cherry user menu and each destination on September 6, 2026. Reference inspection was read-only. No Check Cherry records, billing plans, support conversations or account settings were changed.

| Check Cherry destination | EventDesk implementation |
| --- | --- |
| All Bookings | Business-wide booking list with existing search, status, date, balance and operational filters; switch to My Bookings. |
| My Bookings | Booking list restricted to assignments for the staff record linked in My Profile. Event details open the original complete record. |
| My Appointments | Owner-organized appointments and appointments organized by or including the linked staff member; search, status/date filters, sorting, CSV export and appointment editor. |
| My Calendar | Personal bookings, appointments and approved time off; month/day views, date navigation, event toggles, business blockouts and calendar export. |
| My Profile | Saved name, business name, contact email, phone, address, biography, image, staff link and daily-digest preference. The authenticated sign-in identity stays separate from editable contact details. |
| My Checklist | Owner- and linked-staff-assigned standalone and event checklist items; search, completion and due-date filters, sort, proposal toggle, new/edit/complete actions. Proposals are initially hidden in this personal view. |
| Set Booking Availability | Opens the linked staff member's existing weekly availability and time-off tools. Provides explicit staff setup/link actions if no active record is linked. |
| Appointment Scheduling | Opens the linked staff member's existing appointment calendars, details, settings and share tools. |
| Client Documents | Business-private library, search, new/edit document, file upload/media selection, open/download, saved staff/customer visibility preferences, and confirmed removal from the library. Removing the library entry retains the underlying file. |
| Billing | Separate EventDesk subscription page with Subscription, Billing History and Activity tabs. Customer event payments remain in Payments. |
| Support | Searchable EventDesk help, links to relevant workspace tools, product updates, and a saved/copyable support-request draft. |
| Sign Out | Existing ChatGPT sign-out route. |

## Connections and deliberate limits

- Staff assignment is explicit in My Profile; ownership of the business alone does not imply assignment to every booking.
- Separate staff/customer authentication is not connected. Document visibility choices are saved preferences, not public access grants. The site remains owner-private.
- Calendar export is a downloadable snapshot. Live calendar subscriptions and external calendar sync are not connected. Mini-session scheduling is not implemented by this update.
- Password reset and two-factor authentication belong to the ChatGPT sign-in provider; no competing application password system is introduced.
- Daily-digest delivery remains disconnected, consistent with the user's drafts/review preference.
- EventDesk subscription prices, billing provider, charges, saved cards, plan changes and invoices are not fabricated from Check Cherry's subscription. They require the user's later billing setup.
- Check Cherry's support email, live chat, video tutorials, webinars and setup-review calls are not EventDesk services. EventDesk provides local help and support drafts; it does not send support messages.

## Validation

- Actual account route and prepared SQL exercised against an in-memory SQLite database: authentication, cross-origin checks, profile and draft persistence, stale-write conflicts, document create/edit/archive, same-business staff/media validation and cross-business rejection.
- Personal assignment filtering tested for owner assignments, linked-staff organizers, staff attendees, event tasks and unrelated staff records; source snapshots remain unchanged.
- Actual React account pages rendered with an in-memory controller. Local account endpoint checked with authenticated and anonymous read-only requests.
- Browser checks covered the menu, profile fields, personal appointment editor, checklist filters, document upload form and billing tabs. No temporary business fixtures were saved for this review.

## Reference pages

- User menu and dashboard: https://sipovac-photobooth.checkcherry.com/dashboard
- Personal profile: https://sipovac-photobooth.checkcherry.com/users/417957-dan-sipovac/edit
- Calendar: https://sipovac-photobooth.checkcherry.com/users/417957-dan-sipovac/event_calendar
- Availability: https://sipovac-photobooth.checkcherry.com/users/417957-dan-sipovac/blockout_date_ranges
- Appointment scheduling: https://sipovac-photobooth.checkcherry.com/users/417957-dan-sipovac/user_appointment_calendars
- Documents: https://sipovac-photobooth.checkcherry.com/documents
- Billing and activity: https://sipovac-photobooth.checkcherry.com/admin/billing
- Support: https://sipovac-photobooth.checkcherry.com/support
