import type { FieldSpec } from './settings';
export const bulkPackageSections: Record<string, FieldSpec[]> = {
  'Pricing & duration': [
    { key: 'taxable', label: 'Taxable', type: 'checkbox' },
    { key: 'extraHours', label: 'Charge for extra hours', type: 'checkbox' },
    {
      key: 'extraRate',
      label: 'Extra-hour rate (USD)',
      type: 'number',
      min: 0,
      max: 1000000,
    },
    {
      key: 'includedMinutes',
      label: 'Included duration (minutes)',
      type: 'number',
      min: 15,
      max: 10080,
    },
    {
      key: 'minMinutes',
      label: 'Minimum duration (minutes)',
      type: 'number',
      min: 15,
      max: 10080,
    },
    {
      key: 'maxMinutes',
      label: 'Maximum duration (minutes)',
      type: 'number',
      min: 15,
      max: 10080,
    },
    {
      key: 'increment',
      label: 'Duration increment (minutes)',
      type: 'select',
      options: ['15', '30', '60', '120', '180', '240'],
    },
    {
      key: 'unitMode',
      label: 'Unit pricing',
      type: 'select',
      options: ['None', 'Per unit'],
    },
    { key: 'unitLabel', label: 'Unit label' },
    {
      key: 'minUnits',
      label: 'Minimum units',
      type: 'number',
      min: 1,
      max: 100000,
    },
    {
      key: 'maxUnits',
      label: 'Maximum units',
      type: 'number',
      min: 1,
      max: 100000,
    },
  ],
  Deposit: [
    {
      key: 'depositMode',
      label: 'Deposit requirement',
      type: 'select',
      options: ['Business default', 'Flat rate', 'Percentage', 'None'],
    },
    {
      key: 'depositValue',
      label: 'Deposit value (USD or %)',
      type: 'number',
      min: 0,
      max: 1000000,
    },
  ],
  Scheduling: [
    {
      key: 'dateMode',
      label: 'Scheduling type',
      type: 'select',
      options: ['Date & Time', 'Date Only'],
    },
    {
      key: 'picker',
      label: 'Calendar mode',
      type: 'select',
      options: ['Minimal', 'Automatic slots', 'Predefined slots'],
    },
    { key: 'slots', label: 'Predefined start times (09:00, 14:00)' },
  ],
  Availability: [
    { key: 'startTime', label: 'Available from (HH:MM)' },
    { key: 'endTime', label: 'Available until (HH:MM)' },
    { key: 'days', label: 'Available weekdays', type: 'checkbox' },
  ],
  Advanced: [
    { key: 'showTitle', label: 'Show package title', type: 'checkbox' },
    { key: 'subheader', label: 'Booking subheader' },
    {
      key: 'bookingMode',
      label: 'Request type',
      type: 'select',
      options: ['Booking request', 'Proposal request', 'Lead form'],
    },
    {
      key: 'leadDays',
      label: 'Minimum lead time (days)',
      type: 'number',
      min: 0,
      max: 730,
    },
    {
      key: 'requiredStaff',
      label: 'Required staff count',
      type: 'number',
      min: 0,
      max: 100,
    },
    { key: 'requireBackdrop', label: 'Uses backdrops', type: 'checkbox' },
    {
      key: 'allowSkipBackdrop',
      label: 'Allow skipping backdrop',
      type: 'checkbox',
    },
    { key: 'includedAddonIds', label: 'Included add-ons', type: 'checkbox' },
  ],
};
export const bulkSettingKeys = new Set(
  Object.values(bulkPackageSections)
    .flat()
    .map((f) => f.key),
);
