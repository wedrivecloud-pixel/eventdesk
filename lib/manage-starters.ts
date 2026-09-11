export const templateStarters: Record<
  string,
  { name: string; data: Record<string, string | number | boolean> }[]
> = {
  messages: [
    {
      name: 'Inquiry received',
      data: {
        category: 'Leads',
        subject: 'Thanks for reaching out, {{client}}',
        body: 'Hi {{client}},\n\nThank you for contacting {{business}} about {{event}}. We will review your request and follow up with availability and options.\n\n{{business}}',
      },
    },
    {
      name: 'Your proposal',
      data: {
        category: 'Proposals',
        subject: 'Your proposal for {{event}}',
        body: 'Hi {{client}},\n\nYour proposal for {{date}} is ready for review. The estimated total is {{total}}. Let us know if you have any questions.\n\n{{business}}',
      },
    },
    {
      name: 'Event details reminder',
      data: {
        category: 'Bookings',
        subject: 'Preparing for {{event}}',
        body: 'Hi {{client}},\n\nWe are looking forward to your event on {{date}}. Please review your event details and share any final updates.\n\n{{business}}',
      },
    },
  ],
  automations: [
    {
      name: 'Event preparation reminder',
      data: {
        eventTrigger: 'Scheduled Date',
        offset: 7,
        timeUnit: 'Days',
        timing: 'Before',
        recipient: 'Client',
        subject: 'A few details before {{event}}',
        body: 'Hi {{client}},\n\nYour event on {{date}} is coming up. Please review the details and send us any updates.\n\n{{business}}',
      },
    },
  ],
  checklists: [
    {
      name: 'Confirm event details',
      data: {
        body: 'Confirm event details',
        notes: 'Check the venue, timing, contact and selected services.',
        offset: 7,
        timeUnit: 'Days',
        timing: 'Before',
        dateBasis: 'Event date',
      },
    },
  ],
};
