import type { Data, EventRecord } from './crm';
import { eventDates } from './package-pricing';
export const salesGroups = [
  ['Bookings', 'Proposals', 'Leads', 'Appointments'],
  ['Calendar'],
  ['To-do List', 'Messages', 'Staffing'],
  ['Expenses', 'Payments', 'Reporting'],
];
export type SalesKind =
  | 'appointment'
  | 'task'
  | 'message'
  | 'time_off'
  | 'expense_category'
  | 'expense_rule'
  | 'saved_report'
  | 'attachment';
export type SalesRecord = {
  id: string;
  kind: SalesKind;
  data: Record<string, any>;
  archived: number;
  created_at: string;
  updated_at: string;
};
export type SalesMeta = {
  heat?: 'Hot' | 'Warm' | 'Cold' | '';
  review?: boolean;
  signature?: 'Awaiting' | 'Recorded';
  signatureDate?: string;
  notes?: string;
  origin?: string;
  expires?: string;
  confirmedAt?: string;
  proposalCreatedAt?: string;
  automationsPaused?: boolean;
};
export const activeEvent = (e: EventRecord) =>
  !e.lifecycle || e.lifecycle === 'Active';
export const localToday = (data: Data) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: String(data.settings?.timezone || 'America/Los_Angeles'),
  }).format(new Date());
export const salesRows = (
  data: Data,
  kind: SalesKind,
  includeArchived = false,
) =>
  (data.sales || []).filter(
    (r) => r.kind === kind && (includeArchived || !r.archived),
  );
export function balance(e: EventRecord, data: Data) {
  return Math.max(
    0,
    e.total -
      (data.payments || [])
        .filter((p) => p.event_id === e.id)
        .reduce((n, p) => n + p.amount, 0),
  );
}
export function coverage(e: EventRecord, data: Data) {
  const required = e.items.reduce(
      (n, p) => n + (p.packageSettings?.requiredStaff || 0),
      0,
    ),
    assigned = (e.operations?.staffIds || []).filter((id) =>
      data.resources?.some(
        (r) => r.id === id && r.kind === 'staff' && !r.archived,
      ),
    );
  return {
    required,
    assigned,
    missing: Math.max(0, required - assigned.length),
  };
}
export function dateAdd(day: string, days: number) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const occupiedDates = (e: EventRecord) => eventDates(e.items, e.date);
export function csvText(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let s = String(value ?? '');
          if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
}
export function downloadCsv(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
    new Blob(['\ufeff' + csvText(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseCsv(input: string) {
  if (input.length > 1000000) throw Error('CSV files must be under 1 MB.');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  input = input.replace(/^\ufeff/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell) throw Error('Invalid CSV quoting.');
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(cell);
      cell = '';
      if (c !== ',') {
        if (c === '\r' && input[i + 1] === '\n') i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw Error('Unclosed CSV quote.');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > 201) throw Error('Import up to 200 rows at a time.');
  return rows;
}
export const expenseCategories = [
  'Advertising & Marketing',
  'Automobile',
  'Bank Fees',
  'Dues & Subscriptions',
  'Equipment',
  'Insurance',
  'Job Supplies',
  'Legal & Professional Fees',
  'Licenses & Permits',
  'Maintenance & Repairs',
  'Meals & Entertainment',
  'Miscellaneous Expense',
  'Office Supplies & Software',
  'Rent or Lease',
  'Software',
  'Staff Payments',
  'Taxes & Licenses',
  'Travel',
  'Utilities',
  'Web Hosting',
  'Staff',
  'Venue',
  'Marketing',
  'Supplies',
  'Other',
];
