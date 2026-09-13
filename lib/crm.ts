import type { PackageSettings } from './package-config';
import type { Settings, Resource } from './settings';
import type { Quote } from './quote';
import type { SalesRecord, SalesMeta } from './sales';
import type { FormField } from './manage-config';
export const services = [
  'Photobooths',
  'DJs',
  'Bartenders',
  'Venues',
  'Photographers',
  'Entertainment production',
  'Videographers',
  'Live bands',
  'Casino parties',
  'Character performers',
  'Face painting',
  'Magicians',
  'Kids’ party entertainment',
];
export type Business = {
  id: string;
  name: string;
  email: string;
  phone: string;
  services: string[];
};
export type PackageImage = {
  id: string;
  package_id: string;
  is_primary: number;
  alt: string;
};
export type PackageRecord = {
  settings?: PackageSettings;
  images?: PackageImage[];
  id: string;
  name: string;
  service: string;
  price: number;
  duration: string;
  description: string;
};
export type LineItem = {
  description?: string;
  extraMinutes?: number;
  packageSettings?: PackageSettings;
  basePrice?: number;
  minutes?: number;
  units?: number;
  id: string;
  name: string;
  service: string;
  price: number;
  duration: string;
};
export type EventRecord = {
  operations?: {
    brand?: import('./brands').Brand;
    showDiscountCode?: boolean;
    invoice?: import('./proposal').InvoiceDetails;
    quote?: Quote;
    tasks?: {
      id: string;
      label: string;
      done: boolean;
      due?: string;
      assignee?: string;
      notes?: string;
      templateId?: string;
      templateIndex?: number;
      categoryId?: string;
      categoryName?: string;
      showTodo?: boolean;
      staffView?: boolean;
      staffEdit?: boolean;
      clientView?: boolean;
    }[];
    questions?: ({
      id: string;
      label: string;
      answer: string;
      templateId?: string;
      sourceId?: string;
    } & Partial<FormField>)[];
    questionsFinalized?: boolean;
    bookingAnswers?: Record<string, string>;
    bookingFields?: FormField[];
    paymentPlan?: {
      id: string;
      name: string;
      schedule: { date: string; amount: number; label: string }[];
    };
    customerRequest?: {
      venueDetails?: import('./booking-venue').BookingVenue;
      receivedAt: string;
      fields?: FormField[];
      answers?: Record<string, string>;
      values?: Record<string, string>;
      formId?: string;
      formName?: string;
      message?: string;
    };
    staffIds?: string[];
    designId?: string;
    designCollections?: import('./design-collections').BookingDesignCollection[];
    contract?: string;
    sales?: SalesMeta;
  };
  id: string;
  title: string;
  client: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  venue: string;
  source: string;
  status: 'lead' | 'proposal' | 'confirmed';
  lifecycle?:
    | 'Active'
    | 'Canceled'
    | 'Postponed'
    | 'Archived'
    | 'Spam'
    | 'Deleted';
  items: LineItem[];
  total: number;
  deposit: number;
  notes: string;
  follow_up: string;
  created_at: string;
  updated_at: string;
};
export type Payment = {
  id: string;
  event_id: string;
  amount: number;
  method: string;
  date: string;
  reference: string;
  tip?: number;
  created_at?: string;
  voided_at?: string;
  voided_by?: string;
  voided_by_name?: string;
  void_reason?: string;
};
export type Data = {
  business: Business | null;
  packages: PackageRecord[];
  events: EventRecord[];
  settings?: Settings;
  resources?: Resource[];
  payments?: Payment[];
  // Effective payments stay separate so existing balances and reports exclude voids.
  voidedPayments?: Payment[];
  sales?: SalesRecord[];
};
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export const prettyDate = (value: string) =>
  value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date to be decided';
export function text(
  value: unknown,
  label: string,
  max = 200,
  required = true,
): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error(
      `${label} is required and must be under ${max} characters.`,
    );
  return value.trim();
}
export function date(value: unknown, label: string, required = true) {
  const v = text(value, label, 10, required);
  if (!v && !required) return '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw new Error(`${label} must be a valid date.`);
  return v;
}
export function cents(value: unknown, label: string) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 100000000
  )
    throw new Error(
      `${label} must be a valid amount between $0 and $1,000,000.`,
    );
  return value;
}
export function email(value: unknown) {
  const v = text(value, 'Email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    throw new Error('Enter a valid email address.');
  return v.toLowerCase();
}
export function serviceList(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30)
    throw new Error('Choose at least one service, up to 30.');
  return [...new Set(value.map((v) => text(v, 'Service', 70)))];
}
export function nextStatus(current: string, next: unknown) {
  if (!['lead', 'proposal', 'confirmed'].includes(String(next)))
    throw new Error('Unknown event status.');
  if (current === next) return current;
  if (
    (current === 'lead' && next === 'proposal') ||
    (current === 'proposal' && next === 'confirmed') ||
    (current === 'confirmed' && next === 'proposal')
  )
    return String(next);
  throw new Error('Move leads to proposals before confirming a booking.');
}
