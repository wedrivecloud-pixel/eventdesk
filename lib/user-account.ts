import { text, email, type Data } from './crm';
import type { SalesRecord } from './sales';
import type { Resource } from './settings';

export const userMenuGroups = [
  ['All Bookings', 'My Bookings', 'My Appointments', 'My Calendar'],
  [
    'My Profile',
    'My Checklist',
    'Set Booking Availability',
    'Appointment Scheduling',
    'Client Documents',
  ],
  ['Billing', 'Support'],
];
export type UserProfile = {
  firstName: string;
  lastName: string;
  company: string;
  contactEmail: string;
  phone: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  bio: string;
  photoId: string;
  staffId: string;
  dailyDigest: boolean;
};
export type AccountState = {
  overview?: import('./overview-preferences').OverviewLayout;
  overviewRevenue?: import('./overview-preferences').RevenuePreferences;
  dashboard?: import('./overview').DashboardLayout;
  identity: { displayName: string; email: string; fullName: string | null };
  profile: UserProfile;
  updatedAt: string;
  supportDraft: { subject: string; body: string };
  documents: Resource[];
};
export function defaultProfile(): UserProfile {
  return {
    firstName: '',
    lastName: '',
    company: '',
    contactEmail: '',
    phone: '',
    street: '',
    city: '',
    region: '',
    postalCode: '',
    bio: '',
    photoId: '',
    staffId: '',
    dailyDigest: false,
  };
}
export function checkedProfile(input: Record<string, unknown>): UserProfile {
  const p = defaultProfile();
  for (const k of [
    'firstName',
    'lastName',
    'company',
    'phone',
    'street',
    'city',
    'region',
    'postalCode',
    'bio',
    'photoId',
    'staffId',
  ] as const)
    p[k] = text(
      input[k] ?? '',
      k === 'firstName' ? 'First name' : k,
      k === 'bio' ? 5000 : 200,
      k === 'firstName',
    );
  p.contactEmail = input.contactEmail ? email(input.contactEmail) : '';
  if (typeof input.dailyDigest !== 'boolean')
    throw Error('Choose a valid daily digest preference.');
  p.dailyDigest = input.dailyDigest;
  return p;
}
export const assignedToMe = (assignee: unknown, staffId: string) =>
  assignee === 'owner' || (!!staffId && assignee === staffId);
export const myAppointment = (r: SalesRecord, staffId: string) =>
  assignedToMe(r.data.organizer, staffId) ||
  (!!staffId &&
    Array.isArray(r.data.staffIds) &&
    r.data.staffIds.includes(staffId));
export function personalData(data: Data, staffId: string, view: string): Data {
  return {
    ...data,
    events:
      view === 'My Appointments'
        ? data.events
        : view === 'My Checklist'
          ? data.events.map((e) => ({
              ...e,
              operations: {
                ...e.operations,
                tasks: (e.operations?.tasks || []).filter((t) =>
                  assignedToMe(t.assignee, staffId),
                ),
              },
            }))
          : data.events.filter(
              (e) => !!staffId && e.operations?.staffIds?.includes(staffId),
            ),
    sales: (data.sales || []).filter((r) =>
      r.kind === 'appointment'
        ? myAppointment(r, staffId)
        : r.kind === 'task'
          ? assignedToMe(r.data.assignee, staffId)
          : r.kind === 'time_off'
            ? !!staffId && r.data.staffId === staffId
            : true,
    ),
  };
}
