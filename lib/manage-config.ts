import type { FieldSpec, Module, Resource } from './settings';

const f = (
  key: string,
  label: string,
  type: FieldSpec['type'] = 'text',
  extra: Partial<FieldSpec> = {},
): FieldSpec => ({ key, label, type, ...extra });
const number = (key: string, label: string, value = 0, max = 1000000) =>
  f(key, label, 'number', { min: 0, max, default: value });
const choice = (
  key: string,
  label: string,
  options: string[],
  value = options[0],
) => f(key, label, 'select', { options, default: value });
const toggle = (key: string, label: string, value = false) =>
  f(key, label, 'checkbox', { default: value });
export const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const automationTriggers = [
  'Booked Date',
  'Scheduled Date',
  'Payment Due Date',
  'Customer Signed',
  'Add-on Added to Booking',
  'Extra Added to Booking',
  'Staff Assigned to Booking',
  'Staff Removed from Booking',
  'Questionnaire Marked Complete',
  'Attachment Uploaded',
  'Payment Recorded',
  'Scheduled Payment Due Date',
  'Scheduled Auto Pay Payment Failed',
  'Tip Received',
  'Refund Recorded',
  'Booking Modified',
  'Booking Canceled',
  'Proposal Creation Date',
  'Proposal Expiration Date',
  'Proposal First Viewed',
  'Proposed Date',
  'Proposal Canceled',
  'Lead Creation Date',
  'Lead Scheduled Event Date',
  'Lead Type Changed',
  'Appointment Created',
  'Appointment Scheduled Time',
  'Appointment Rescheduled',
  'Appointment Canceled',
];
export const fieldTypes = [
  'Text Field',
  'Double Text Field',
  'Triple Text Field',
  'Quadruple Text Field',
  'Text Box',
  'Dropdown',
  'Radio Buttons',
  'Checkbox',
  'Checkbox Group',
  'Date Field',
  'Time Field',
  'Color Picker',
  'Header',
  'Subheader',
  'Separator',
  'Plain Text',
  'Rich Text',
  'Static Image',
  'Song',
  'Song List',
  'Spotify Playlist',
  'Apple Music Playlist',
  'YouTube Music Playlist',
  'Streaming Service Playlist',
  'File Upload Field',
  'Image Upload Field',
];
export type FormField = {
  id: string;
  label: string;
  type: string;
  hint: string;
  placeholder: string;
  required: boolean;
  options: string[];
  tab: string;
  repeat: boolean;
  timeline: boolean;
  conditionField: string;
  conditionValue: string;
};
export type LeadField = {
  key: string;
  label: string;
  display: 'Required' | 'Optional' | 'Hidden';
  width: '50%' | '100%';
};
export type Condition = { field: string; operator: string; value: string };
export type ResourceDetails = {
  version: 1;
  packageMode: 'all' | 'selected' | 'none';
  packageIds: string[];
  includedPackageIds: string[];
  images: string[];
  videos: { title: string; url: string }[];
  attachments: string[];
  fields: FormField[];
  tabs: string[];
  conditions: Condition[];
  days: number[];
  leadFields: LeadField[];
  tags: string[];
  requiredAddonIds: string[];
};
export const emptyDetails = (): ResourceDetails => ({
  version: 1,
  packageMode: 'all',
  packageIds: [],
  includedPackageIds: [],
  images: [],
  videos: [],
  attachments: [],
  fields: [],
  tabs: ['General'],
  conditions: [],
  days: [0, 1, 2, 3, 4, 5, 6],
  leadFields: [],
  tags: [],
  requiredAddonIds: [],
});
export function details(value?: Resource | Resource['data']): ResourceDetails {
  const data =
    value && 'kind' in value && 'data' in value
      ? (value as Resource).data
      : (value as Resource['data'] | undefined);
  try {
    return { ...emptyDetails(), ...JSON.parse(String(data?.details || '{}')) };
  } catch {
    return emptyDetails();
  }
}
export const ordered = (rows: Resource[]) =>
  [...rows].sort(
    (a, b) =>
      Number(a.data.position || 0) - Number(b.data.position || 0) ||
      a.name.localeCompare(b.name),
  );
export function appliesTo(r: Resource, packageIds: string[]) {
  const d = details(r);
  return (
    d.packageMode === 'all' ||
    (d.packageMode === 'selected' &&
      d.packageIds.some((id) => packageIds.includes(id)))
  );
}
export function categoryFor(r: Resource, catalog: Resource[]) {
  return catalog.find(
    (c) => c.kind === 'categories' && c.id === r.data.categoryId && !c.archived,
  );
}
export function effectiveExtra(r: Resource, catalog: Resource[]) {
  const category = categoryFor(r, catalog),
    data = { ...r.data };
  if (data.inheritPrice && category) data.price = category.data.price || 0;
  if (data.inheritLead && category) data.leadDays = category.data.leadDays || 0;
  return { ...r, data };
}
export function extraAvailable(
  r: Resource,
  catalog: Resource[],
  ids: string[],
) {
  const category = categoryFor(r, catalog);
  return (
    !r.archived &&
    appliesTo(r, ids) &&
    (!r.data.categoryId || Boolean(category)) &&
    (!category || appliesTo(category, ids))
  );
}
export const enhancedFields: Record<string, FieldSpec[]> = {
  addons: [
    choice('pricingMethod', 'Pricing method', [
      'Flat rate / per unit',
      'Multiply by package hours',
      'Multiply by package days',
    ]),
    number('maxQuantity', 'Maximum quantity per booking', 1, 1000),
    number(
      'extensionMinutes',
      'Extend booking by (minutes per unit)',
      0,
      10080,
    ),
    number('leadDays', 'Required lead time (days)', 0, 365),
    toggle('showGallery', 'Show in Add-on Gallery', true),
    toggle('taxable', 'Taxable', true),
  ],
  backdrops: [
    toggle('inheritPrice', 'Use category default price'),
    toggle('inheritLead', 'Use category default lead time'),
    number('leadDays', 'Required lead time (days)', 0, 365),
    toggle('showGallery', 'Show in Backdrop Gallery', true),
    toggle('taxable', 'Taxable', true),
  ],
  discounts: [
    f('starts', 'First valid date', 'date'),
    choice('dateBasis', 'Valid dates are based on', [
      'Scheduled event date',
      'Booking date',
    ]),
    choice('scope', 'Discount applies to', [
      'Complete booking',
      'Each specific item',
      'Package and its extras',
    ]),
    number('maxRedemptions', 'Maximum redemptions (0 = unlimited)', 0, 1000000),
    toggle('allowProposalRedemption', 'Customers may redeem on proposals'),
  ],
  flex: [
    choice('ruleType', 'Rule type', ['Surcharge', 'Discount']),
    choice('mode', 'Calculation', ['Percentage', 'Fixed amount']),
    number('amount', 'Amount (% or USD)'),
    choice('scope', 'Applies to', [
      'Complete booking',
      'Each specific item',
      'Package and its extras',
    ]),
    f('description', 'Private notes', 'textarea'),
    f('bookStarts', 'First booking date', 'date'),
    f('bookEnds', 'Last booking date', 'date'),
    number('withinDays', 'Within this many days (0 = any)', 0, 1095),
    number('moreThanDays', 'More than this many days', 0, 1095),
    number('minimumSubtotal', 'Minimum subtotal (USD)'),
    number('maximumSubtotal', 'Maximum subtotal (0 = any, USD)'),
    choice('locationType', 'Venue restriction', [
      'Any',
      'City',
      'State / province',
      'Postal code',
      'Saved place',
    ]),
    f('locationValues', 'Locations (comma separated)'),
    choice('setupLocation', 'Setup location', ['Any', 'Indoor', 'Outdoor']),
    choice('stairs', 'Stair setup', ['Any', 'Yes', 'No']),
    f('endTimeStart', 'End time from (HH:MM)'),
    f('endTimeEnd', 'End time through (HH:MM)'),
  ],
  messages: [
    choice('channel', 'Message type', ['Email', 'SMS']),
    choice('category', 'Use with', [
      'Bookings',
      'Proposals',
      'Leads',
      'Appointments',
    ]),
    choice('recipient', 'Recipients', [
      'Client',
      'My business',
      'Assigned staff',
      'Client and my business',
      'Client, staff and my business',
    ]),
    choice('replyTo', 'Replies to', ['My business', 'Assigned staff']),
    f('tags', 'Tags (comma separated)'),
  ],
  automations: [
    choice('channel', 'Message type', ['Email', 'SMS']),
    choice('eventTrigger', 'Event trigger', automationTriggers),
    number('offset', 'Timing amount', 1, 1000),
    choice(
      'timeUnit',
      'Timing unit',
      ['Minutes', 'Hours', 'Days', 'Weeks', 'Months', 'Years'],
      'Days',
    ),
    choice('timing', 'Timing', ['When', 'Before', 'After', 'Manual']),
    choice('recipient', 'Recipients', [
      'Client',
      'My business',
      'Assigned staff',
      'Client and my business',
      'Client, staff and my business',
    ]),
    choice('replyTo', 'Replies to', ['My business', 'Assigned staff']),
    f('tags', 'Tags (comma separated)'),
  ],
  questionnaires: [
    choice('showWhen', 'When to show', [
      'Always',
      'Before event',
      'After event',
    ]),
    toggle('staffView', 'Staff may view', true),
    toggle('staffEdit', 'Staff may fill out', true),
    toggle('clientView', 'Clients may view', true),
    toggle('clientEdit', 'Clients may fill out until finalized', true),
  ],
  checklists: [
    f('notes', 'Item notes', 'textarea'),
    toggle('automaticDue', 'Automatically assign due date', true),
    number('offset', 'Due offset', 1, 365),
    choice('timeUnit', 'Due unit', ['Days', 'Weeks', 'Months']),
    choice('timing', 'Due timing', ['Before', 'After']),
    choice('dateBasis', 'Based on', [
      'Event date',
      'Payment due date',
      'Book date',
    ]),
    f('assignee', 'Assigned staff ID'),
  ],
  designs: [
    f('tagIds', 'Design category IDs'),
    f('layoutIds', 'Design layout IDs'),
    f('preset', 'Layout preview'),
    f('searchText', 'Extra search text', 'textarea'),
    f('layout', 'Layout'),
    f('tags', 'Categories (comma separated)'),
    toggle('showGallery', 'Show in Design Gallery', true),
  ],
  staff: [
    f('company', 'Business name'),
    f('address', 'Street address'),
    f('city', 'City'),
    f('state', 'State / province'),
    f('postalCode', 'Postal code'),
    f('bio', 'Public bio', 'textarea'),
    toggle('adminRole', 'Admin role'),
    toggle('staffRole', 'Staff role', true),
    toggle('customerRole', 'Customer role'),
    toggle('showContact', 'Show contact details to assigned clients'),
    toggle('showGallery', 'Show public staff profile'),
    toggle('showDuringBooking', 'Offer during online booking'),
    toggle('dailyDigest', 'Prepare daily digest'),
  ],
  venues: [
    f('city', 'City'),
    f('state', 'State / province'),
    f('postalCode', 'Postal code'),
    f('publicNotes', 'Public notes', 'textarea'),
    toggle('proposalCover', 'Use photo as proposal cover'),
  ],
};
export const manageModules: Record<string, Module> = {
  design_tags: { label: 'Design categories', description: 'Categories within a design collection.', fields: [] },
  design_layouts: { label: 'Design layouts', description: 'Layouts within a design collection.', fields: [] },
  unavailable_notices: {
    label: 'Unavailable notices',
    description:
      'Show a tailored notice when selected packages cannot be booked.',
    fields: [f('body', 'Notice', 'textarea', { required: true })],
  },
  categories: {
    label: 'Catalog categories',
    description: 'Organize related records and set shared defaults.',
    fields: [
      choice('ownerKind', 'Category for', [
        'addons',
        'backdrops',
        'designs',
        'checklists',
      ]),
      f('subheader', 'Subheader'),
      choice('sortTemplates', 'Sort templates', ['Default', 'Alphabetically', 'Date Added']),
      number('price', 'Default price (USD)'),
      number('leadDays', 'Default lead time (days)', 0, 365),
      toggle('showGallery', 'Show category in galleries', true),
      toggle('showTodo', 'Show checklist items in To-do List', true),
      toggle('staffView', 'Staff may view and check items', true),
      toggle('staffEdit', 'Staff may edit items', true),
      toggle('clientView', 'Clients may view and check items'),
    ],
  },
  payment_methods: {
    label: 'Payment options',
    description: 'Payment instructions for funds collected outside EventDesk.',
    fields: [
      toggle('enabled', 'Show this payment option', true),
      f('instructions', 'Payment instructions', 'textarea'),
      f('foreground', 'Button text color', 'color', { default: '#ffffff' }),
      f('background', 'Button color', 'color', { default: '#315ee8' }),
      toggle('showInvoice', 'Show on invoices'),
    ],
  },
  payment_plans: {
    label: 'Payment plans',
    description:
      'Offer deposits, installments or full payment and preview the schedule.',
    fields: [
      choice('planType', 'Payment plan', [
        'Deposit + final payment',
        'Deposit + monthly payments',
        'Deposit + equal installments',
        'Pay in full',
      ]),
      number('splitCount', 'Number of payments after deposit', 3, 24),
      toggle('enabled', 'Offer this plan', true),
    ],
  },
  booking_questions: {
    label: 'Extra booking questions',
    description: 'Collect additional information during booking or internally.',
    fields: [
      f('label', 'Question text', 'text', { required: true }),
      choice('inputType', 'Input type', [
        'Text Field',
        'Text Box',
        'Dropdown',
        'Radio Buttons',
        'Checkbox Group',
        'Address',
        'Date Field',
        'Time Field',
        'File Upload Field',
      ]),
      f('hint', 'Hint'),
      f('options', 'Choices (one per line)', 'textarea'),
      choice('collect', 'Collect', [
        'During online booking and proposals',
        'Internal only',
      ]),
      toggle('required', 'Answer required'),
    ],
  },
  extra_categories: {
    label: 'Extra categories',
    description:
      'Additional catalog categories with customer visibility controls.',
    fields: [
      f('options', 'Items (one per line)', 'textarea'),
      toggle('required', 'Selection required'),
      choice('visibility', 'Customer visibility', [
        'Always show',
        'Only when added to booking',
        'Internal only',
      ]),
    ],
  },
  booking_presets: {
    label: 'Booking presets',
    description:
      'Customize the booking introduction and colors for selected packages.',
    fields: [
      f('headline', 'Header text'),
      f('subheading', 'Subheader text'),
      f('cta', 'Package button text', 'text', { default: 'Choose package' }),
      f('color', 'Primary color', 'color', { default: '#315ee8' }),
      f('background', 'Background color', 'color', { default: '#f4f6fb' }),
      choice('layout', 'Package layout', ['Cards', 'List']),
    ],
  },
  travel_zones: {
    label: 'Travel zones',
    description:
      'Calculate travel charges using the distance entered on a quote.',
    fields: [
      number('minimumDistance', 'Minimum distance'),
      number('maximumDistance', 'Maximum distance (0 = unlimited)', 0, 10000),
      choice('unit', 'Distance unit', ['mi', 'km']),
      f('origin', 'Origin address', 'textarea'),
      choice('feeType', 'Travel fee', ['No fee', 'Flat fee', 'Distance based']),
      number('price', 'Flat fee / fee per unit (USD)'),
      number('freeDistance', 'Free distance', 0, 10000),
      toggle('roundTrip', 'Round trip'),
    ],
  },
  tax_zones: {
    label: 'Tax zones',
    description: 'Apply your entered tax rates to matching venue states.',
    fields: [
      number('rate', 'Tax rate (%)', 0, 100),
      f('states', 'State / province codes (comma separated)'),
      f('label', 'Invoice tax label', 'text', { default: 'Tax' }),
    ],
  },
  lead_forms: {
    label: 'Lead forms',
    description:
      'Build and embed inquiry forms. Submissions appear in Leads for review.',
    fields: [
      f('buttonText', 'Submit button text', 'text', {
        default: 'Send inquiry',
      }),
      f('confirmation', 'Confirmation message', 'textarea', {
        default: 'Thank you. We will be in touch shortly.',
      }),
      choice('afterSubmit', 'After successful submission', [
        'Show confirmation',
        'Open booking page',
        'Open URL',
      ]),
      f('redirectUrl', 'Redirect URL', 'url'),
      toggle('defaultForm', 'Use as default contact form'),
    ],
  },
  proposal_presets: {
    label: 'Proposal presets',
    description: 'Set the appearance of new proposals for selected packages.',
    fields: [
      choice('theme', 'Theme', ['Classic', 'Modern', 'Dark']),
      choice('pricingTitle', 'Pricing section title', [
        'Pricing',
        'Investment',
        'The Numbers',
        'The Math',
        'Pricing Summary',
      ]),
      number('maxReviews', 'Maximum reviews', 5, 30),
      number('maxPhotos', 'Maximum gallery photos', 18, 30),
    ],
  },
  reviews: {
    label: 'Reviews',
    description: 'Customer reviews approved by you for proposal presentation.',
    fields: [
      f('reviewer', 'Reviewer', 'text', { required: true }),
      number('rating', 'Rating (1–5)', 5, 5),
      f('body', 'Review', 'textarea', { required: true }),
      f('date', 'Review date', 'date'),
      toggle('published', 'Show on new proposals'),
    ],
  },
  song_lists: {
    label: 'Song lists',
    description: 'Reusable song suggestions for entertainment questionnaires.',
    fields: [
      f('body', 'Songs — title and artist, one per line', 'textarea', {
        required: true,
      }),
      f('url', 'Playlist URL', 'url'),
    ],
  },
  inventory_rules: {
    label: 'Availability rules',
    description: 'Limit concurrent bookings across selected packages.',
    fields: [
      number('capacity', 'Maximum concurrent bookings', 1, 1000),
      f('description', 'Notes', 'textarea'),
    ],
  },
};
export const manageGroups = [
  ['Packages', 'Add-ons', 'Backdrops', 'Discount codes', 'Flex pricing'],
  [
    'Automated messages',
    'Message templates',
    'Questionnaire templates',
    'Checklist templates',
    'Design collections',
  ],
  [
    'User accounts',
    'Booking engine',
    'Payment settings',
    'Business settings',
    'Website integration',
  ],
  ['Refer friends'],
];
export const leadFieldNames: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company name',
  email: 'Email',
  phone: 'Phone',
  date: 'Event date',
  time: 'Event time',
  hours: 'Hours needed',
  venue: 'Venue name',
  address: 'Venue address',
  customerAddress: 'Customer address',
  budget: 'Estimated budget',
  guests: 'Estimated guests',
  setupLocation: 'Indoor / outdoor',
  stairs: 'Stair setup',
  eventType: 'Event type',
  packageId: 'Package',
  staffId: 'Staff',
  contactPreference: 'Contact preference',
  source: 'Lead source',
  title: 'Subject',
  notes: 'Message',
};
export const defaultLeadFields = (): LeadField[] =>
  Object.entries(leadFieldNames).map(([key, label]) => ({
    key,
    label,
    display: ['firstName', 'email'].includes(key)
      ? 'Required'
      : ['phone', 'date', 'notes'].includes(key)
        ? 'Optional'
        : 'Hidden',
    width: key === 'notes' ? '100%' : '50%',
  }));
