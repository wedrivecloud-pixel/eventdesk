import { automationTriggers, emptyDetails } from './manage-config';
import type { Resource, Settings } from './settings';

export const messageTabs = [
  'Automated Messages',
  'Custom Templates',
  'System Templates',
];
export const messageCategories = [
  'Bookings',
  'Proposals',
  'Leads',
  'Appointments',
];
export const recipientRoles = [
  'Client',
  'My business',
  'Assigned staff',
  'Primary attendee',
  'Additional attendees',
];
export const dateTriggers = [
  'Scheduled Date',
  'Payment Due Date',
  'Scheduled Payment Due Date',
  'Proposal Expiration Date',
  'Proposed Date',
  'Lead Scheduled Event Date',
  'Appointment Scheduled Time',
];
export function triggerCategory(trigger: string) {
  return trigger.startsWith('Appointment')
    ? 'Appointments'
    : trigger.startsWith('Proposal') || trigger === 'Proposed Date'
      ? 'Proposals'
      : trigger.startsWith('Lead')
        ? 'Leads'
        : 'Bookings';
}
const descriptions: Record<string, string> = {
  'Booked Date':
    'Based on when a booking was secured, after you approve or confirm it.',
  'Scheduled Date': 'Before or after the date and time of a confirmed booking.',
  'Payment Due Date': 'Before or after the final payment due date.',
  'Customer Signed': 'When a customer signature is recorded.',
  'Add-on Added to Booking':
    'When an add-on is added, including at booking creation.',
  'Extra Added to Booking': 'When an extra is added to a booking.',
  'Staff Assigned to Booking': 'When staff are assigned to a booking.',
  'Staff Removed from Booking': 'When a staff assignment is removed.',
  'Questionnaire Marked Complete': 'When a questionnaire is finalized.',
  'Attachment Uploaded': 'When a file is attached to a booking.',
  'Payment Recorded': 'When an online or manual payment is recorded.',
  'Scheduled Payment Due Date': 'Before or after an installment is due.',
  'Scheduled Auto Pay Payment Failed':
    'When a scheduled automatic payment fails.',
  'Tip Received': 'When a tip is recorded.',
  'Refund Recorded': 'When a refund is recorded.',
  'Booking Modified': 'When booking details change.',
  'Booking Canceled': 'When a booking is canceled.',
  'Proposal Creation Date': 'Based on when the proposal was first created.',
  'Proposal Expiration Date': 'Before or after a proposal expires.',
  'Proposal First Viewed': 'When a client first views a proposal.',
  'Proposed Date': 'Before or after the proposed event date.',
  'Proposal Canceled': 'When a proposal is canceled.',
  'Lead Creation Date':
    'Based on when an inquiry or booking request was received.',
  'Lead Scheduled Event Date': 'Before or after a lead’s requested event date.',
  'Lead Type Changed': 'When a lead’s type changes.',
  'Appointment Created': 'Based on when an appointment was created.',
  'Appointment Scheduled Time': 'Before or after an appointment starts.',
  'Appointment Rescheduled': 'When an appointment is rescheduled.',
  'Appointment Canceled': 'When an appointment is canceled.',
};
export const triggers = automationTriggers.map((name) => ({
  name,
  category: triggerCategory(name),
  description: descriptions[name],
  before: dateTriggers.includes(name),
}));
export function normalizedMessage(r: Resource): Resource {
  const old = String(r.data.trigger || ''),
    legacy: Record<string, string> = {
      'New lead': 'Lead Creation Date',
      'Proposal created': 'Proposal Creation Date',
      'Booking confirmed': 'Booked Date',
      'Before event': 'Scheduled Date',
      'After event': 'Scheduled Date',
      'Payment recorded': 'Payment Recorded',
    };
  const eventTrigger = String(
    r.data.eventTrigger || legacy[old] || 'Booked Date',
  );
  return {
    ...r,
    data: {
      channel: 'Email',
      category: 'Bookings',
      recipient: 'Client',
      replyTo: 'My business',
      enabled: true,
      reviewBeforeSending: true,
      timeUnit: 'Days',
      offset: Number(r.data.days ?? 1),
      timing:
        r.kind === 'automations'
          ? old === 'Before event'
            ? 'Before'
            : old === 'After event'
              ? 'After'
              : 'When'
          : 'Manual',
      ...r.data,
      eventTrigger,
    },
  };
}
export function rolesFor(d: Settings) {
  if (d.recipientRoles)
    return String(d.recipientRoles)
      .split('|')
      .filter((r) => recipientRoles.includes(r));
  const legacy = String(d.recipient || 'Client').toLowerCase();
  return [
    legacy.includes('client') && 'Client',
    legacy.includes('business') && 'My business',
    legacy.includes('staff') && 'Assigned staff',
  ].filter(Boolean) as string[];
}
export function timingLabel(r: Resource) {
  const d = normalizedMessage(r).data;
  const unit = String(d.timeUnit).toLowerCase();
  return d.timing === 'Manual'
    ? 'Manual preparation only'
    : d.timing === 'When'
      ? 'Immediately when triggered'
      : `${d.offset} ${Number(d.offset) === 1 ? unit.replace(/s$/, '') : unit} ${String(d.timing).toLowerCase()}`;
}
export type MessageStarter = {
  key: string;
  name: string;
  description: string;
  kind: string;
  data: Settings;
};
function starter(
  key: string,
  name: string,
  category: string,
  body: string,
  extra: Settings = {},
): MessageStarter {
  return {
    key,
    name,
    description: name,
    kind: 'messages',
    data: {
      category,
      channel: 'Email',
      recipient: 'Client',
      replyTo: 'My business',
      subject: name + ': {{event_title}}',
      body: 'Hello {{client_first_name}},\n\n' + body + '\n\n{{business_name}}',
      ...extra,
    },
  };
}
export const systemTemplates: MessageStarter[] = [
  starter(
    'customer-invitation',
    'Customer Invitation',
    'Bookings',
    'Your client workspace is ready. Use this personal invitation to access your event details:\n{{invitation_link}}',
  ),
  starter(
    'send-gallery',
    'Send Gallery',
    'Bookings',
    'Your event gallery is ready to explore and download:\n{{event_photo_album_link}}',
  ),
  starter('send-gallery-sms', 'Send Gallery via SMS', 'Bookings', '', {
    channel: 'SMS',
    body: '{{client_first_name}}, your gallery for {{event_title}} is ready: {{event_photo_album_link}}',
  }),
  starter(
    'send-proposal',
    'Send Proposal',
    'Proposals',
    'Please review the proposal for {{event_date}} here:\n{{proposal_link}}\nReply with any changes or questions.',
  ),
  starter('send-proposal-sms', 'Send Proposal via SMS', 'Proposals', '', {
    channel: 'SMS',
    body: 'Your proposal from {{business_name}} is ready: {{proposal_link}}. Reply with any questions.',
  }),
  starter('staff-invitation', 'Staff Invitation', 'Bookings', '', {
    recipient: 'Assigned staff',
    body: 'Hello {{recipient_first_name}},\n\nYou are invited to join the team at {{business_name}}. Access your invitation here:\n{{invitation_link}}',
  }),
  starter(
    'design-approval',
    'Design Approval Request',
    'Bookings',
    'Your design is ready for feedback. Please review and approve it here:\n{{approve_design_link}}',
  ),
  starter(
    'design-approval-sms',
    'Design Approval Request (SMS)',
    'Bookings',
    '',
    {
      channel: 'SMS',
      body: 'Please review the design for {{event_title}}: {{approve_design_link}}',
    },
  ),
  starter(
    'design-approved',
    'Design Approved',
    'Bookings',
    'The design for {{event_title}} has been approved. Thank you for reviewing it.',
    { recipient: 'Client and my business' },
  ),
  starter('design-revision', 'Design Revision Requested', 'Bookings', '', {
    recipient: 'My business',
    body: 'A design revision was requested for {{event_title}}. Review the client feedback before preparing the next version.\n\n{{business_name}}',
  }),
  starter(
    'design-selected',
    'When a Design Template is selected',
    'Bookings',
    '',
    {
      recipient: 'My business',
      body: '{{client_name}} selected {{design_name}} for {{event_title}} on {{event_date}}.',
    },
  ),
].map((s) => ({
  ...s,
  kind: 'system_templates',
  data: { ...s.data, systemKey: s.key },
}));
export const customStarters = [
  starter(
    'inquiry',
    'Inquiry received',
    'Leads',
    'Thank you for asking about {{event_title}}. We will review your request and follow up with availability and options.',
  ),
  starter(
    'proposal',
    'Your proposal',
    'Proposals',
    'We have prepared options for {{event_date}}. The estimated total is {{event_starting_balance}}. Let us know what you think.',
  ),
  starter(
    'event-details',
    'Event details reminder',
    'Bookings',
    'We look forward to {{event_title}} on {{event_date}} at {{event_time}}. Please share any final changes with us.',
  ),
  starter(
    'appointment-details',
    'Appointment details',
    'Appointments',
    'Your appointment is on {{appointment_date}} at {{appointment_time}}. Please let us know if you need another time.',
  ),
  {
    ...systemTemplates[1],
    key: 'photo-album',
    kind: 'messages',
    data: { ...systemTemplates[1].data, systemKey: '' },
  },
];
const packageDetails =
  'Package details\n{{package_name}}\n{{package_description}}\n{{event_date}} at {{event_time}}\nDuration: {{event_hours}}';
const eventExtras =
  'Add-ons\n{{add_on_list_with_descriptions}}\n\nBackdrop\n{{backdrop_name}}';
const venueDetails = 'Venue\n{{venue_name}}\n{{venue_address}}';
const eventTotals =
  'Event total: {{event_starting_balance}}\nCoupon: {{coupon_code}}\nRetainer remaining: {{event_deposit_due}}\nBalance due: {{event_balance_due}}\nPayment due: {{event_due_date}}';
const eventLinks = 'Event details\n{{event_link}}\n\nInvoice\n{{invoice_link}}';
const eventSummary = [
  packageDetails,
  eventExtras,
  venueDetails,
  eventTotals,
  eventLinks,
].join('\n\n');
const appointmentDetails =
  '{{appointment_title}}\n{{appointment_date}} at {{appointment_time}}\nLocation: {{appointment_location}}';
function automation(
  key: string,
  name: string,
  eventTrigger: string,
  recipient: string,
  subject: string,
  body: string,
  extra: Settings = {},
): MessageStarter {
  return {
    key,
    name,
    description: descriptions[eventTrigger],
    kind: 'automations',
    data: {
      eventTrigger,
      category: triggerCategory(eventTrigger),
      channel: 'Email',
      recipient,
      replyTo: 'My business',
      timing: 'When',
      offset: 0,
      timeUnit: 'Days',
      enabled: false,
      reviewBeforeSending: true,
      subject,
      body: body + '\n\n{{brand_signature}}',
      ...extra,
    },
  };
}
const unpaidCondition = JSON.stringify({
  ...emptyDetails(),
  conditions: [{ field: 'Balance', operator: 'Is', value: 'Not fully paid' }],
});
export const automationStarters: MessageStarter[] = [
  automation(
    'booking-client',
    'Customer Booking Confirmation',
    'Booked Date',
    'Client',
    'Booking confirmed: {{event_title}}',
    'Hello {{client_first_name}},\n\nYour booking with {{business_name}} is confirmed. We look forward to your event. Please review the details below and reply if anything needs updating.\n\nBooked: {{booked_date}}\n\n' +
      eventSummary,
  ),
  automation(
    'booking-owner',
    'Admin Booking Confirmation',
    'Booked Date',
    'My business',
    'New booking: {{event_title}}',
    'A booking was confirmed on {{booked_date}}.\n\nClient\n{{client_name}}\n{{client_email}}\n{{client_phone}}\n\n' +
      eventSummary,
  ),
  automation(
    'event-reminder',
    'Upcoming Event Reminder',
    'Scheduled Date',
    'Client',
    'Getting ready for {{event_title}}',
    'Hello {{client_first_name}},\n\nYour event is coming up. Please check the details and let us know about any final changes.\n\n' +
      eventSummary,
    { timing: 'Before', offset: 3 },
  ),
  automation(
    'send-invoice',
    'Send Invoice to Client',
    'Scheduled Date',
    'Client',
    'Invoice for {{event_title}}',
    'Hello {{client_first_name}},\n\nHere is the invoice for your event on {{event_date}}.\n\n' +
      eventTotals +
      '\n\n{{invoice_link}}\n\nReply if you have a question about your invoice.',
    { timing: 'Manual' },
  ),
  automation(
    'payment-reminder',
    'Final Payment Reminder',
    'Payment Due Date',
    'Client',
    'Payment reminder: {{event_title}}',
    'Hello {{client_first_name}},\n\nThe remaining balance of {{event_balance_due}} is due on {{event_due_date}}. Please review your invoice for payment arrangements. If you have already paid, reply so we can check our records.\n\n{{invoice_link}}',
    { timing: 'Before', offset: 3, details: unpaidCondition },
  ),
  automation(
    'signed',
    'Customer Signed',
    'Customer Signed',
    'My business',
    'Signature recorded: {{event_title}}',
    'A customer signature has been recorded for {{event_title}}.\n\nClient: {{client_name}}\nEvent: {{event_date}}\n\nReview the agreement and next steps in the event record.\n{{event_link}}',
  ),
  automation(
    'addon-added',
    'Add-on Added',
    'Add-on Added to Booking',
    'My business',
    'Add-ons updated: {{event_title}}',
    'An add-on was added to {{event_title}}. Review the current selections and preparation needs.\n\n' +
      eventExtras +
      '\n\n' +
      eventLinks,
  ),
  automation(
    'extra-added',
    'Extra Added',
    'Extra Added to Booking',
    'My business',
    'Extras updated: {{event_title}}',
    'An extra was added to this booking. Review the changes before preparing equipment or staffing.\n\n' +
      eventSummary,
  ),
  automation(
    'staff-assigned',
    'Staff Booking Assignment',
    'Staff Assigned to Booking',
    'Assigned staff',
    'Your assignment: {{event_title}} on {{event_date}}',
    'Hello {{recipient_first_name}},\n\nYou have been assigned to this event. Please review your schedule and contact {{business_name}} with any questions.\n\n' +
      packageDetails +
      '\n\n' +
      eventExtras +
      '\n\n' +
      venueDetails,
  ),
  automation(
    'staff-removed',
    'Staff Assignment Removed',
    'Staff Removed from Booking',
    'My business',
    'Staff assignment changed: {{event_title}}',
    'A staff assignment was removed from {{event_title}} on {{event_date}}. Review coverage for the event.\n\nCurrent staff: {{staff_names}}\n\n{{event_link}}',
  ),
  automation(
    'questions-complete',
    'Questionnaire Completed',
    'Questionnaire Marked Complete',
    'My business',
    'Questionnaire ready to review: {{event_title}}',
    '{{client_name}}’s questionnaire has been marked complete. Review the answers and update event preparations as needed.\n\n{{event_link}}',
  ),
  automation(
    'attachment-uploaded',
    'New Event Attachment',
    'Attachment Uploaded',
    'My business',
    'Attachment added: {{event_title}}',
    'An attachment was added to {{event_title}}. Open the event to review the file and its visibility settings.\n\n{{event_link}}',
  ),
  automation(
    'payment-receipt',
    'Customer Payment Receipt',
    'Payment Recorded',
    'Client',
    'Payment recorded for {{event_title}}',
    'Hello {{client_first_name}},\n\nWe recorded your payment of {{payment_amount}} on {{payment_date}}. Thank you.\n\nBalance remaining: {{event_balance_due}}\n\nYour updated invoice\n{{invoice_link}}',
  ),
  automation(
    'payment-owner',
    'Business Payment Notification',
    'Payment Recorded',
    'My business',
    'Payment received: {{event_title}}',
    'A payment of {{payment_amount}} was recorded on {{payment_date}} for {{client_name}}.\n\nBalance remaining: {{event_balance_due}}\n\n{{invoice_link}}',
  ),
  automation(
    'installment-reminder',
    'Scheduled Payment Reminder',
    'Scheduled Payment Due Date',
    'Client',
    'Upcoming payment for {{event_title}}',
    'Hello {{client_first_name}},\n\nYour scheduled payment of {{scheduled_payment_amount}} is due on {{scheduled_payment_date}}. Review your invoice or contact us with questions.\n\n{{invoice_link}}',
    { timing: 'Before', offset: 3 },
  ),
  automation(
    'payment-failed',
    'Failed Scheduled Payment Notification',
    'Scheduled Auto Pay Payment Failed',
    'My business',
    'Payment needs attention: {{event_title}}',
    'A scheduled payment for {{client_name}} did not complete. Check the payment record before arranging a retry or contacting the client.\n\n{{event_link}}',
  ),
  automation(
    'payment-failed-client',
    'Customer Failed Payment Notice',
    'Scheduled Auto Pay Payment Failed',
    'Client',
    'Please review your payment for {{event_title}}',
    'Hello {{client_first_name}},\n\nYour scheduled payment did not complete. Please contact us to review your payment arrangements.\n\nInvoice\n{{invoice_link}}',
  ),
  automation(
    'tip',
    'Tip Thank You',
    'Tip Received',
    'Client',
    'Thank you from {{business_name}}',
    'Hello {{client_first_name}},\n\nThank you for your tip and for choosing us for {{event_title}}. We appreciate your support.',
  ),
  automation(
    'refund',
    'Refund Confirmation',
    'Refund Recorded',
    'Client and my business',
    'Refund recorded: {{event_title}}',
    'A refund of {{refund_amount}} was recorded on {{refund_date}} for {{event_title}}. Contact {{business_name}} if you have questions about the refund.\n\nUpdated invoice\n{{invoice_link}}',
  ),
  automation(
    'booking-modified',
    'Booking Details Updated',
    'Booking Modified',
    'Client and my business',
    'Updated details: {{event_title}}',
    'The details for {{event_title}} have changed. Please review the current booking below.\n\n' +
      eventSummary,
  ),
  automation(
    'booking-canceled',
    'Booking Cancellation',
    'Booking Canceled',
    'Client and my business',
    'Booking canceled: {{event_title}}',
    'The booking for {{event_title}} on {{event_date}} has been canceled. Contact {{business_name}} with questions about next steps or any remaining balance. This notice does not confirm that a refund has been issued.\n\n{{invoice_link}}',
    { recipientRoles: 'Client|My business|Assigned staff' },
  ),
  automation(
    'proposal-created',
    'Proposal Ready',
    'Proposal Creation Date',
    'Client',
    'Your proposal from {{business_name}}',
    'Hello {{client_first_name}},\n\nYour proposal for {{event_title}} is ready. Review the packages and options, and reply with any questions.\n\n{{proposal_link}}',
  ),
  automation(
    'proposal-expiring',
    'Proposal Expiration Reminder',
    'Proposal Expiration Date',
    'Client',
    'Your proposal expires soon: {{event_title}}',
    'Hello {{client_first_name}},\n\nYour proposal expires on {{proposal_expiration_date}}. Please review it and contact us if you need changes or more time. Your booking is confirmed only after our confirmation process is complete.\n\n{{proposal_link}}',
    { timing: 'Before', offset: 1 },
  ),
  automation(
    'proposal-viewed',
    'Proposal Viewed Notification',
    'Proposal First Viewed',
    'My business',
    'Proposal viewed: {{event_title}}',
    '{{client_name}} viewed the proposal for {{event_date}}. Review any questions and plan your follow-up.\n\n{{proposal_link}}',
  ),
  automation(
    'proposed-date',
    'Proposed Event Follow-up',
    'Proposed Date',
    'Client',
    'Checking in about {{event_title}}',
    'Hello {{client_first_name}},\n\nYour proposed event date is {{event_date}}. Are you still considering {{package_name}}? Reply with questions or review the proposal here.\n\n{{proposal_link}}',
    { timing: 'Before', offset: 7 },
  ),
  automation(
    'proposal-canceled',
    'Proposal Canceled',
    'Proposal Canceled',
    'Client',
    'Proposal closed: {{event_title}}',
    'Hello {{client_first_name}},\n\nThe proposal for {{event_title}} has been canceled. Contact {{business_name}} if you would like to discuss a new date or different options.',
  ),
  automation(
    'lead-received',
    'New Inquiry Notification',
    'Lead Creation Date',
    'My business',
    'New inquiry: {{event_title}}',
    'A new inquiry is ready for review.\n\n{{client_name}}\n{{client_email}}\n{{client_phone}}\nRequested event: {{event_date}}\nPackage: {{package_name}}\n\nFollow up with availability and the next steps.',
  ),
  automation(
    'lead-follow-up',
    'Customer Inquiry Follow-up',
    'Lead Creation Date',
    'Client',
    'Let’s plan your event, {{client_first_name}}',
    'Hello {{client_first_name}},\n\nThank you for your interest in {{business_name}}. We received your inquiry about {{event_title}}. Reply with any questions or details you would like us to consider. Your request is awaiting review.',
    { timing: 'After', offset: 30, timeUnit: 'Minutes' },
  ),
  automation(
    'lead-date',
    'Inquiry Event Date Follow-up',
    'Lead Scheduled Event Date',
    'Client',
    'Still planning {{event_title}}?',
    'Hello {{client_first_name}},\n\nWe are checking in about your requested event on {{event_date}}. Let us know if you would like us to prepare a proposal or if your plans have changed.',
    { timing: 'Before', offset: 7 },
  ),
  automation(
    'lead-type',
    'Lead Status Changed',
    'Lead Type Changed',
    'My business',
    'Lead updated: {{event_title}}',
    'The lead type for {{client_name}} has changed. Review their inquiry and next follow-up.\n\n{{client_email}}\n{{client_phone}}\nRequested event: {{event_date}}',
  ),
  automation(
    'appointment-created',
    'Customer Appointment Confirmation',
    'Appointment Created',
    'Client',
    'Your appointment with {{business_name}}',
    'Hello {{client_first_name}},\n\nYour appointment is scheduled.\n\n' +
      appointmentDetails +
      '\n\nReply if you need to reschedule.',
    { recipientRoles: 'Primary attendee|Additional attendees' },
  ),
  automation(
    'appointment-staff',
    'Staff Appointment Confirmation',
    'Appointment Created',
    'Assigned staff',
    'Appointment scheduled: {{appointment_title}}',
    'Hello {{recipient_first_name}},\n\nYou have been assigned to this appointment.\n\n' +
      appointmentDetails,
  ),
  automation(
    'appointment-reminder',
    'Appointment Reminder',
    'Appointment Scheduled Time',
    'Client',
    'Reminder: {{appointment_title}}',
    'Hello {{client_first_name}},\n\nWe look forward to meeting with you.\n\n' +
      appointmentDetails +
      '\n\nPlease contact us if you need to change your plans.',
    {
      timing: 'Before',
      offset: 1,
      timeUnit: 'Hours',
      recipientRoles: 'Primary attendee|Additional attendees',
    },
  ),
  automation(
    'appointment-rescheduled',
    'Appointment Rescheduled',
    'Appointment Rescheduled',
    'Client',
    'New appointment time: {{appointment_title}}',
    'Hello {{client_first_name}},\n\nYour appointment has been rescheduled. Here are the updated details.\n\n' +
      appointmentDetails,
    { recipientRoles: 'Primary attendee|Additional attendees|Assigned staff' },
  ),
  automation(
    'appointment-canceled',
    'Appointment Canceled',
    'Appointment Canceled',
    'Client',
    'Appointment canceled: {{appointment_title}}',
    'The appointment below has been canceled. Contact {{business_name}} if you would like to arrange another time.\n\n' +
      appointmentDetails,
    { recipientRoles: 'Primary attendee|Additional attendees|Assigned staff' },
  ),
];

/** Fresh form state only; never backfill or overwrite a business’s saved copy. */
export function newAutomationMessage(trigger: string): Resource {
  const template = automationStarters.find(
    (t) => t.data.eventTrigger === trigger,
  );
  if (!template) throw Error('Unknown automated message trigger.');
  return {
    id: '',
    kind: 'automations',
    name: template.name,
    archived: 0,
    data: { ...template.data },
  };
}
export const messageTokens = [
  'booked_date',
  'created_date',
  'client_name',
  'client_first_name',
  'client_last_name',
  'client_email',
  'client_phone',
  'recipient_name',
  'recipient_first_name',
  'recipient_last_name',
  'recipient_email',
  'business_name',
  'brand_signature',
  'event_title',
  'event_date',
  'event_time',
  'event_hours',
  'add_on_list_with_descriptions',
  'event_link',
  'invoice_link',
  'event_date_day_of_week',
  'event_starting_balance',
  'event_balance_due',
  'event_deposit_due',
  'event_due_date',
  'package_name',
  'package_description',
  'package_service_name',
  'venue_name',
  'venue_address',
  'staff_names',
  'design_name',
  'backdrop_name',
  'coupon_code',
  'appointment_title',
  'appointment_date',
  'appointment_time',
  'appointment_location',
  'proposal_expiration_date',
  'payment_amount',
  'payment_date',
  'scheduled_payment_amount',
  'scheduled_payment_date',
  'refund_amount',
  'refund_date',
  'invitation_link',
  'proposal_link',
  'event_photo_album_link',
  'approve_design_link',
];
export const conditionOptions: Record<string, string[]> = {
  Balance: ['Fully paid', 'Not fully paid'],
  Deposit: ['Paid', 'Not fully paid'],
  Tips: ['Received', 'Not received'],
  Staff: ['Assigned', 'Not assigned'],
  Backdrop: ['Selected', 'Not selected'],
  Designs: ['Selected', 'Not selected'],
  Contract: ['Signed', 'Not signed'],
  Questionnaires: ['Complete', 'Incomplete'],
  'Date Status': ['Upcoming', 'Today', 'Past'],
  'Day of week': [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],
  Origin: [],
  'Lead Type': ['Hot', 'Warm', 'Cold'],
  'Excluded Package': [],
  'Add-on': [],
  'Uploaded By': ['Customer', 'Staff', 'My business'],
  Referrals: ['Referred', 'Not referred'],
};
