import { modules } from './settings';
import { manageGroups } from './manage-config';
import { userMenuGroups } from './user-account';

export type NavigationItem = {
  label: string;
  view?: string;
  icon: string;
  children?: { label: string; view: string }[];
};
export const workspaceGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Daily work',
    items: [
      { label: 'Overview', view: 'Overview', icon: 'home' },
      { label: 'Calendar', view: 'Calendar', icon: 'calendar' },
      { label: 'Tasks', view: 'To-do List', icon: 'tasks' },
      { label: 'Messages', view: 'Messages', icon: 'messages' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Leads', view: 'Leads', icon: 'users' },
      { label: 'Proposals', view: 'Proposals', icon: 'file' },
      { label: 'Bookings', view: 'Bookings', icon: 'calendar' },
    ],
  },
  {
    label: 'Business',
    items: [
      {
        label: 'Services',
        icon: 'package',
        children: [
          { label: 'Packages', view: 'Packages' },
          { label: 'Add-ons', view: 'Add-ons' },
          { label: 'Backdrops', view: 'Backdrops' },
          { label: 'Discount codes', view: 'Discount codes' },
          { label: 'Pricing rules', view: 'Flex pricing' },
          { label: 'Design collections', view: 'Design collections' },
        ],
      },
      {
        label: 'Team',
        icon: 'users',
        children: [
          { label: 'Assignments & time off', view: 'Staffing' },
          { label: 'Team members', view: 'Staff & user accounts' },
          { label: 'My availability', view: 'Set Booking Availability' },
        ],
      },
      {
        label: 'Finance',
        icon: 'wallet',
        children: [
          { label: 'Payments', view: 'Payments' },
          { label: 'Expenses', view: 'Expenses' },
          { label: 'Customer payment settings', view: 'Payment settings' },
        ],
      },
      { label: 'Reports', view: 'Reporting', icon: 'reports' },
    ],
  },
  {
    label: 'Setup',
    items: [
      {
        label: 'Templates',
        icon: 'file',
        children: [
          { label: 'Questionnaires', view: 'Questionnaire templates' },
          { label: 'Checklists', view: 'Checklist templates' },
          { label: 'Contracts & terms', view: 'Contract templates' },
        ],
      },
      {
        label: 'Online booking',
        icon: 'link',
        children: [
          { label: 'Booking setup', view: 'Booking engine' },
          { label: 'Links & website widgets', view: 'Website integration' },
          { label: 'Lead forms', view: 'Lead forms' },
        ],
      },
      {
        label: 'Settings',
        icon: 'settings',
        children: [
          { label: 'Business settings', view: 'Business settings' },
          { label: 'Places & venues', view: 'Places & venues' },
          { label: 'EventDesk subscription', view: 'Billing' },
          { label: 'My documents', view: 'Client Documents' },
          { label: 'Referrals', view: 'Refer friends' },
          { label: 'All setup tools', view: 'Manage' },
        ],
      },
    ],
  },
];

const aliases: Record<string, string> = {
  'Package Manager': 'Packages',
  'User accounts': 'Staff & user accounts',
  'All Bookings': 'Bookings',
  Tasks: 'To-do List',
  Reports: 'Reporting',
};
export const workspaceViews = [
  ...new Set(
    [
      ...workspaceGroups.flatMap((g) =>
        g.items.flatMap((i) =>
          i.children ? i.children.map((c) => c.view) : [i.view!],
        ),
      ),
      ...manageGroups.flat(),
      ...userMenuGroups.flat(),
      ...Object.values(modules).map((m) => m.label),
      'Appointments',
    ].map((v) => aliases[v] || v),
  ),
];
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const bySlug = new Map(workspaceViews.map((v) => [slug(v), v]));
export function canonicalView(value: string): string {
  const v = aliases[value] || value;
  return workspaceViews.includes(v) ? v : 'Overview';
}
export function viewFromSearch(search: string): string {
  return (
    bySlug.get(new URLSearchParams(search).get('section') || '') || 'Overview'
  );
}
export function workspaceHref(view: string): string {
  const v = canonicalView(view);
  return v === 'Overview' ? '/' : '/?section=' + slug(v);
}
const titles: Record<string, string> = {
  'To-do List': 'Tasks',
  'My Checklist': 'My tasks',
  Reporting: 'Reports',
  'Staff & user accounts': 'Team members',
  'Set Booking Availability': 'My availability',
  'Website integration': 'Links & website widgets',
  'Booking engine': 'Booking setup',
  'Payment settings': 'Customer payment settings',
  Billing: 'EventDesk subscription',
  'Client Documents': 'My documents',
  Manage: 'Setup tools',
  'Flex pricing': 'Pricing rules',
};
export const viewTitle = (view: string) =>
  titles[canonicalView(view)] || canonicalView(view);
export function navigationParent(view: string): string {
  const v = canonicalView(view);
  if (
    [
      'Calendar',
      'Appointments',
      'My Calendar',
      'My Appointments',
      'Appointment Scheduling',
    ].includes(v)
  )
    return 'Calendar';
  if (['To-do List', 'My Checklist'].includes(v)) return 'Tasks';
  if (
    [
      'Messages',
      'Automated messages',
      'Message templates',
      'System templates',
    ].includes(v)
  )
    return 'Messages';
  if (v === 'My Bookings') return 'Bookings';
  for (const group of workspaceGroups)
    for (const item of group.items) {
      if (item.view === v || item.children?.some((c) => c.view === v))
        return item.label;
    }
  return 'Settings';
}
export function contextualLinks(
  view: string,
): { label: string; view: string }[] {
  const parent = navigationParent(view);
  if (parent === 'Messages')
    return [
      { label: 'Messages', view: 'Messages' },
      { label: 'Automations', view: 'Automated messages' },
      { label: 'Custom templates', view: 'Message templates' },
      { label: 'System templates', view: 'System templates' },
    ];
  if (parent === 'Calendar')
    return [
      { label: 'Calendar', view: 'Calendar' },
      { label: 'Appointments', view: 'Appointments' },
      { label: 'Appointment scheduling', view: 'Appointment Scheduling' },
    ];
  return [];
}
export function scopeLinks(view: string): { label: string; view: string }[] {
  const groups = [
    ['Bookings', 'My Bookings'],
    ['Calendar', 'My Calendar'],
    ['Appointments', 'My Appointments'],
    ['To-do List', 'My Checklist'],
  ];
  const group = groups.find((g) => g.includes(canonicalView(view)));
  return group
    ? [
        { label: 'All', view: group[0] },
        { label: 'Assigned to me', view: group[1] },
      ]
    : [];
}
