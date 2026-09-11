import { enhancedFields, manageModules } from './manage-config';
export type FieldSpec = {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'select'
    | 'color'
    | 'email'
    | 'url'
    | 'checkbox';
  options?: string[];
  min?: number;
  max?: number;
  default?: string | number | boolean;
  help?: string;
  required?: boolean;
};
export type Resource = {
  created_at?: string;
  id: string;
  kind: string;
  name: string;
  data: Record<string, string | number | boolean>;
  archived: number;
};
export type Settings = Record<string, string | number | boolean>;
export type Module = {
  label: string;
  description: string;
  fields: FieldSpec[];
  note?: string;
};
export const modules: Record<string, Module> = {
  addons: {
    label: 'Add-ons',
    description: 'Optional upgrades and extras you can add to any event.',
    fields: [
      {
        key: 'price',
        label: 'Price (USD)',
        type: 'number',
        min: 0,
        max: 1000000,
        required: true,
      },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  backdrops: {
    label: 'Backdrops',
    description: 'Your backdrop collection and rental upgrades.',
    fields: [
      {
        key: 'price',
        label: 'Upgrade price (USD)',
        type: 'number',
        min: 0,
        max: 1000000,
        default: 0,
      },
      {
        key: 'description',
        label: 'Color, material, size and setup notes',
        type: 'textarea',
      },
    ],
  },
  designs: {
    label: 'Design collections',
    description: 'Organize print layouts, artwork and design references.',
    fields: [
      { key: 'service', label: 'Service or collection' },
      { key: 'url', label: 'Design reference URL', type: 'url' },
      {
        key: 'description',
        label: 'Dimensions and design notes',
        type: 'textarea',
      },
    ],
  },
  discounts: {
    label: 'Discount codes',
    description: 'Apply fixed or percentage discounts to an event quote.',
    fields: [
      { key: 'code', label: 'Discount code', required: true },
      {
        key: 'mode',
        label: 'Discount type',
        type: 'select',
        options: ['Percentage', 'Fixed amount'],
        default: 'Percentage',
      },
      {
        key: 'amount',
        label: 'Discount value (% or USD)',
        type: 'number',
        min: 0,
        max: 1000000,
        required: true,
      },
      { key: 'expires', label: 'Valid through (event date)', type: 'date' },
      { key: 'description', label: 'Internal notes', type: 'textarea' },
    ],
  },
  flex: {
    label: 'Flex pricing',
    description:
      'Apply a percentage adjustment to packages and extras on selected event days.',
    fields: [
      {
        key: 'day',
        label: 'Apply on',
        type: 'select',
        options: [
          'Every day',
          'Weekends',
          'Weekdays',
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        default: 'Weekends',
      },
      {
        key: 'percent',
        label: 'Adjustment (%)',
        type: 'number',
        min: -100,
        max: 100,
        required: true,
      },
      { key: 'starts', label: 'First event date', type: 'date' },
      { key: 'ends', label: 'Last event date', type: 'date' },
    ],
    note: 'Matching rules are added together. Quotes keep their pricing after they are created.',
  },
  messages: {
    label: 'Message templates',
    description:
      'Reusable messages for inquiries, proposals and event follow-ups.',
    fields: [
      { key: 'subject', label: 'Subject', required: true },
      {
        key: 'body',
        label: 'Message',
        type: 'textarea',
        required: true,
        help: 'Use {{client}}, {{event}}, {{business}}, {{date}}, {{total}}.',
      },
    ],
  },
  automations: {
    label: 'Automated messages',
    description: 'Prepare your reminder and follow-up rules.',
    fields: [
      {
        key: 'trigger',
        label: 'Trigger',
        type: 'select',
        options: [
          'New lead',
          'Proposal created',
          'Booking confirmed',
          'Before event',
          'After event',
          'Payment recorded',
        ],
        default: 'Before event',
      },
      {
        key: 'days',
        label: 'Days before / after event',
        type: 'number',
        min: 0,
        max: 365,
        default: 7,
      },
      { key: 'subject', label: 'Subject', required: true },
      { key: 'body', label: 'Message', type: 'textarea', required: true },
    ],
    note: 'Saved as drafts. Automatic sending will remain off until an email provider and sending schedule are connected.',
  },
  questionnaires: {
    label: 'Questionnaire templates',
    description: 'Build the questions you need for each type of event.',
    fields: [
      { key: 'service', label: 'Service (optional)' },
      {
        key: 'body',
        label: 'Questions — one per line',
        type: 'textarea',
        required: true,
      },
    ],
    note: 'Attach a template to an event and record answers in its planning workspace.',
  },
  checklists: {
    label: 'Checklist templates',
    description: 'Reusable preparation, setup and wrap-up tasks.',
    fields: [
      { key: 'service', label: 'Service (optional)' },
      {
        key: 'body',
        label: 'Tasks — one per line',
        type: 'textarea',
        required: true,
      },
    ],
  },
  contracts: {
    label: 'Contract templates',
    description: 'Keep your booking terms and service agreements organized.',
    fields: [
      { key: 'body', label: 'Contract text', type: 'textarea', required: true },
    ],
    note: 'Templates can be included in proposals. Electronic signatures are not connected yet.',
  },
  staff: {
    label: 'Staff & user accounts',
    description: 'Build your team roster and assign staff to events.',
    fields: [
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'phone', label: 'Phone' },
      {
        key: 'role',
        label: 'Team role',
        type: 'select',
        options: ['Manager', 'Coordinator', 'Staff', 'Contractor'],
        default: 'Staff',
      },
      { key: 'services', label: 'Services / skills' },
      { key: 'notes', label: 'Internal notes', type: 'textarea' },
    ],
    note: 'Roster and assignments are available. Invitations and staff login permissions are not active yet.',
  },
  venues: {
    label: 'Places & venues',
    description: 'Save locations you work at regularly.',
    fields: [
      { key: 'address', label: 'Address', required: true },
      {
        key: 'capacity',
        label: 'Guest capacity',
        type: 'number',
        min: 0,
        max: 1000000,
      },
      { key: 'contact', label: 'Venue contact' },
      { key: 'phone', label: 'Contact phone' },
      {
        key: 'notes',
        label: 'Access and setup instructions',
        type: 'textarea',
      },
    ],
  },
  expenses: {
    label: 'Expenses',
    description: 'Record operating costs to compare against bookings.',
    fields: [
      {
        key: 'amount',
        label: 'Amount (USD)',
        type: 'number',
        min: 0,
        max: 1000000,
        required: true,
      },
      { key: 'date', label: 'Expense date', type: 'date', required: true },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          'Equipment',
          'Staff',
          'Travel',
          'Venue',
          'Marketing',
          'Supplies',
          'Other',
        ],
        default: 'Other',
      },
      { key: 'notes', label: 'Reference and notes', type: 'textarea' },
    ],
  },
};
for (const [kind, fields] of Object.entries(enhancedFields))
  modules[kind].fields.push(...fields);
Object.assign(modules, manageModules);
modules.system_templates = {
  label: 'System templates',
  description: 'Customize the built-in message templates for your business.',
  fields: [
    ...modules.messages.fields,
    { key: 'systemKey', label: 'System template' },
  ],
};
for (const kind of ['messages', 'automations', 'system_templates']) {
  modules[kind].fields = modules[kind].fields.map((f) =>
    f.key === 'subject' ? { ...f, required: false } : f,
  );
  modules[kind].fields.push(
    { key: 'recipientRoles', label: 'Recipient roles' },
    { key: 'extraRecipients', label: 'Additional recipients' },
    { key: 'customReplyTo', label: 'Custom reply address', type: 'email' },
    { key: 'enabled', label: 'Rule enabled', type: 'checkbox', default: true },
    {
      key: 'reviewBeforeSending',
      label: 'Review before sending',
      type: 'checkbox',
      default: true,
    },
  );
}
export const settingGroups: Record<string, Module> = {
  branding: {
    label: 'Branding',
    description: 'Your brand, location and contact presentation.',
    fields: [
      {
        key: 'color',
        label: 'Primary brand color',
        type: 'color',
        default: '#315ee8',
      },
      { key: 'address', label: 'Business address', type: 'textarea' },
      { key: 'website', label: 'Business website', type: 'url' },
      {
        key: 'timezone',
        label: 'Time zone',
        type: 'select',
        options: [
          'America/Los_Angeles',
          'America/Phoenix',
          'America/Denver',
          'America/Chicago',
          'America/New_York',
          'Pacific/Honolulu',
          'Europe/London',
          'Australia/Sydney',
        ],
        default: 'America/Los_Angeles',
      },
      { key: 'footer', label: 'Proposal footer', type: 'textarea' },
    ],
  },
  booking: {
    label: 'Booking engine',
    description: 'Customize the booking introduction and package selection.',
    fields: [
      {
        key: 'headline',
        label: 'Header text',
        default: 'Let’s plan your next event.',
      },
      {
        key: 'subheading',
        label: 'Subheader text',
        default: 'Choose your services and tell us about your event.',
      },
      {
        key: 'cta',
        label: 'Call-to-action text',
        default: 'Request a proposal',
      },
      {
        key: 'multiplePackages',
        label: 'Allow multiple packages per event',
        type: 'checkbox',
        default: true,
      },
    ],
    note: 'The header and subheader appear on your Check availability page. Clients select one public package and submit a request for approval. The call-to-action and multiple-package settings apply to the owner booking preview.',
  },
  payments: {
    label: 'Payment settings',
    description:
      'Default deposits, due dates and offline payment instructions.',
    fields: [
      {
        key: 'depositMode',
        label: 'Default deposit',
        type: 'select',
        options: ['None', 'Percentage', 'Fixed amount'],
        default: 'None',
      },
      {
        key: 'depositValue',
        label: 'Deposit value (% or USD)',
        type: 'number',
        min: 0,
        max: 1000000,
        default: 0,
      },
      {
        key: 'dueDays',
        label: 'Final balance due — days before event',
        type: 'number',
        min: 0,
        max: 365,
        default: 0,
      },
      {
        key: 'paymentInstructions',
        label: 'Offline payment instructions',
        type: 'textarea',
      },
    ],
    note: 'You can record payments received elsewhere. Card processing and automatic charging are not connected.',
  },
  pricing: {
    label: 'Tax & travel',
    description:
      'Set quote defaults. Enter travel distance when creating a lead.',
    fields: [
      { key: 'taxLabel', label: 'Tax label', default: 'Tax' },
      {
        key: 'taxRate',
        label: 'Tax rate (%)',
        type: 'number',
        min: 0,
        max: 100,
        default: 0,
      },
      {
        key: 'travelBase',
        label: 'Base travel fee (USD)',
        type: 'number',
        min: 0,
        max: 1000000,
        default: 0,
      },
      {
        key: 'freeMiles',
        label: 'Included travel miles',
        type: 'number',
        min: 0,
        max: 10000,
        default: 0,
      },
      {
        key: 'mileRate',
        label: 'Fee per additional mile (USD)',
        type: 'number',
        min: 0,
        max: 10000,
        default: 0,
      },
    ],
    note: 'Tax applies to the discounted package and extras amount. Travel is added separately. Rates are business-entered, not calculated by jurisdiction.',
  },
  availability: {
    label: 'Availability',
    description: 'Control booking capacity and dates you cannot accept.',
    fields: [
      {
        key: 'dailyLimit',
        label: 'Maximum confirmed events per day (0 = unlimited)',
        type: 'number',
        min: 0,
        max: 1000,
        default: 0,
      },
      {
        key: 'noticeDays',
        label: 'Minimum booking notice (days)',
        type: 'number',
        min: 0,
        max: 365,
        default: 0,
      },
      {
        key: 'blackoutDates',
        label: 'Unavailable dates — one YYYY-MM-DD per line',
        type: 'textarea',
      },
    ],
    note: 'Checked when confirming a booking. Capacity is counted across all services in this business.',
  },
  proposals: {
    label: 'Proposal defaults',
    description: 'The introduction and terms included with new proposals.',
    fields: [
      {
        key: 'proposalIntro',
        label: 'Proposal introduction',
        type: 'textarea',
        default: 'Thank you for considering us for your event.',
      },
      {
        key: 'proposalTerms',
        label: 'Default booking terms',
        type: 'textarea',
      },
      {
        key: 'validDays',
        label: 'Proposal validity (days from creation)',
        type: 'number',
        min: 1,
        max: 365,
        default: 14,
      },
    ],
    note: 'New quotes keep a copy of these defaults. Later changes do not rewrite existing proposals.',
  },
};
settingGroups.payments.fields.push(
  {
    key: 'dueTiming',
    label: 'Final balance timing',
    type: 'select',
    options: ['Before event', 'After event'],
    default: 'Before event',
  },
  {
    key: 'depositTerm',
    label: 'Initial payment name',
    type: 'select',
    options: ['Deposit', 'Initial Payment', 'Booking Fee', 'Retainer'],
    default: 'Deposit',
  },
  {
    key: 'allowTips',
    label: 'Allow clients to leave a tip',
    type: 'checkbox',
    default: true,
  },
  { key: 'tipMessage', label: 'Tip message' },
);
settingGroups.booking.fields.push(
  {
    key: 'unavailableNotice',
    label: 'Default unavailable notice',
    type: 'textarea',
    default:
      'This date is unavailable. Please choose another date or contact us.',
  },
  { key: 'privacyUrl', label: 'Privacy policy URL', type: 'url' },
  {
    key: 'requireConsent',
    label: 'Require privacy consent before collecting contact details',
    type: 'checkbox',
    default: false,
  },
  {
    key: 'consentText',
    label: 'Consent text',
    type: 'textarea',
    default:
      'I agree to the privacy policy and the use of my information to respond to this inquiry.',
  },
  { key: 'smsDisclaimer', label: 'Phone-number disclaimer', type: 'textarea' },
);
settingGroups.branding.fields.push(
  {
    key: 'contrastColor',
    label: 'Contrast color',
    type: 'color',
    default: '#ffffff',
  },
  {
    key: 'navBackground',
    label: 'Navigation background',
    type: 'color',
    default: '#ffffff',
  },
  {
    key: 'navColor',
    label: 'Navigation text',
    type: 'color',
    default: '#182235',
  },
  {
    key: 'ctaColor',
    label: 'Call-to-action background',
    type: 'color',
    default: '#315ee8',
  },
  {
    key: 'ctaTextColor',
    label: 'Call-to-action text',
    type: 'color',
    default: '#ffffff',
  },
  { key: 'facebookUrl', label: 'Facebook URL', type: 'url' },
  { key: 'instagramUrl', label: 'Instagram URL', type: 'url' },
  { key: 'youtubeUrl', label: 'YouTube URL', type: 'url' },
  { key: 'tiktokUrl', label: 'TikTok URL', type: 'url' },
  { key: 'about', label: 'About your business', type: 'textarea' },
  { key: 'signature', label: 'Message signature', type: 'textarea' },
  {
    key: 'showAddress',
    label: 'Show address on proposals and invoices',
    type: 'checkbox',
    default: true,
  },
  {
    key: 'showFooterEmail',
    label: 'Show public email in footer',
    type: 'checkbox',
    default: true,
  },
  {
    key: 'showFooterAddress',
    label: 'Show address in footer',
    type: 'checkbox',
    default: false,
  },
  {
    key: 'weekStart',
    label: 'Weeks start on',
    type: 'select',
    options: ['Sunday', 'Monday'],
    default: 'Sunday',
  },
);
settingGroups.availability.fields.push({
  key: 'maxWindowDays',
  label: 'Maximum booking window (days, 0 = 3 years)',
  type: 'number',
  min: 0,
  max: 1095,
  default: 0,
});
settingGroups.leads = {
  label: 'Lead settings',
  description: 'Customize the classifications used for incoming inquiries.',
  fields: [
    {
      key: 'leadSources',
      label: 'Lead sources — one per line',
      type: 'textarea',
      default:
        'Website\nGoogle\nSocial media\nReferral\nReturning customer\nOther',
    },
    {
      key: 'leadTypes',
      label: 'Lead types — one per line',
      type: 'textarea',
      default: 'Hot\nWarm\nCold',
    },
    {
      key: 'eventTypes',
      label: 'Event types — one per line',
      type: 'textarea',
      default: 'Wedding\nCorporate\nSchool\nPrivate party',
    },
  ],
};
settingGroups.referrals = {
  label: 'Referral settings',
  description: 'Track referrals associated with booking requests.',
  fields: [
    {
      key: 'referralsEnabled',
      label: 'Enable referral tracking',
      type: 'checkbox',
      default: false,
    },
    {
      key: 'referralTitle',
      label: 'Referral page title',
      default: 'Share our services',
    },
    {
      key: 'referralBody',
      label: 'Referral page message',
      type: 'textarea',
      default: 'Share your booking link with friends and colleagues.',
    },
  ],
};
export const defaultSettings: Settings = Object.fromEntries(
  Object.values(settingGroups).flatMap((g) =>
    g.fields.map((f) => [
      f.key,
      f.default ??
        (f.type === 'number' ? 0 : f.type === 'checkbox' ? false : ''),
    ]),
  ),
);
export const mergedSettings = (s?: Settings) => ({ ...defaultSettings, ...s });

export function checkedFields(input: unknown, fields: FieldSpec[]): Settings {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid form data.');
  const result: Settings = {};
  const value = input as Record<string, unknown>;
  for (const f of fields) {
    const v =
      value[f.key] ??
      f.default ??
      (f.type === 'number' ? 0 : f.type === 'checkbox' ? false : '');
    if (f.type === 'number') {
      if (
        typeof v !== 'number' ||
        !Number.isFinite(v) ||
        v < (f.min ?? 0) ||
        v > (f.max ?? 1000000)
      )
        throw new Error(f.label + ' is outside its allowed range.');
      result[f.key] = v;
      continue;
    }
    if (f.type === 'checkbox') {
      if (typeof v !== 'boolean') throw new Error('Invalid ' + f.label);
      result[f.key] = v;
      continue;
    }
    if (
      typeof v !== 'string' ||
      v.length > (f.type === 'textarea' ? 16000 : 500)
    )
      throw new Error('Invalid ' + f.label);
    const s = v.trim();
    if (f.required && !s) throw new Error(f.label + ' is required.');
    if (
      s &&
      f.type === 'date' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(s) ||
        !Number.isFinite(Date.parse(s)) ||
        new Date(s).toISOString().slice(0, 10) !== s)
    )
      throw new Error('Invalid ' + f.label);
    if (f.type === 'select' && !f.options?.includes(s))
      throw new Error('Invalid ' + f.label);
    if (f.type === 'color' && !/^#[a-fA-F0-9]{6}$/.test(s))
      throw new Error('Choose a valid brand color.');
    if (s && f.type === 'url') {
      const u = new URL(s);
      if (u.protocol !== 'https:' || u.username || u.password)
        throw new Error('Use an HTTPS URL without embedded credentials.');
    }
    if (s && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      throw new Error('Enter a valid email.');
    result[f.key] = s;
  }
  return result;
}
