import type { Data, EventRecord } from './crm';
import { balanceReports, buildBalanceReport } from './balance-reports';
import { buildFrequencyReport } from './frequency-reports';
import { buildUtilizationReport } from './utilization-reports';
import { catalogReports, buildCatalogReport } from './catalog-reports';
import { availabilityReports, buildAvailabilityReport } from './availability-reports';
import {
  activeEvent,
  balance,
  coverage,
  occupiedDates,
  salesRows,
} from './sales';
export const reportNames = [
  'Bookings',
  'Payment History',
  'Leads',
  'Sales Tax',
  'Tips',
  'Balances',
  ...balanceReports,
  'Most Frequently Booked',
  'Utilization',
  'Daily Utilization',
  'Profit & Loss',
  'Expenses',
  'Client List',
  'Places',
  'Blockouts & Availability',
  ...availabilityReports,
  'Packages & Add-ons',
  ...catalogReports,
  'Message History',
  'Email Event History',
  'Login History',
];
export type ReportFilter = {
  from: string;
  to: string;
  status: string;
  search: string;
  group: string;
  staffId?: string;
  timeOffStatus?: string;
  sort?: string;
  enteredFrom?: string;
  enteredTo?: string;
  columns?: string[];
  catalogStatus?: string;
  service?: string;
  packageGroup?: string;
  categoryId?: string;
  utilizationDate?: string;
  dueFrom?: string;
  dueTo?: string;
  dueStatus?: string;
  minAmount?: string;
  maxAmount?: string;
  hasPlan?: string;
  paymentType?: string;
};
export const blankReportFilter: ReportFilter = {
  from: '',
  to: '',
  status: 'All',
  search: '',
  group: 'Packages',
};
export function buildReport(data: Data, name: string, f: ReportFilter) {
  if (balanceReports.includes(name)) return buildBalanceReport(data, name, f);
  if (name === 'Most Frequently Booked') return buildFrequencyReport(data, f);
  if (name === 'Daily Utilization') return buildUtilizationReport(data, f);
  if (catalogReports.includes(name)) return buildCatalogReport(data, name, f);
  if (availabilityReports.includes(name)) return buildAvailabilityReport(data, name, f);
  const between = (day: string) =>
      (!f.from || (!!day && day >= f.from)) &&
      (!f.to || (!!day && day <= f.to)),
    stage = (e: EventRecord) =>
      f.status === 'All' ||
      (f.status === 'Inactive'
        ? !activeEvent(e)
        : f.status === 'Active'
          ? activeEvent(e)
          : activeEvent(e) && e.status === f.status),
    events = data.events.filter(stage),
    dated = events.filter((e) => e.lifecycle !== 'Deleted' && between(e.date)),
    booked = dated.filter((e) => e.status === 'confirmed' && activeEvent(e)),
    payments = (data.payments || []).filter(
      (p) => between(p.date) && events.some((e) => e.id === p.event_id),
    ),
    expenses = (data.resources || []).filter(
      (r) =>
        r.kind === 'expenses' &&
        !r.archived &&
        between(String(r.data.date || '')),
    );
  let headers: string[] = [],
    rows: unknown[][] = [],
    note = 'Dates use the business calendar; amounts are USD.';
  if (name === 'Bookings' || name === 'Leads') {
    headers = [
      'Event',
      'Client',
      'Email',
      'Event date',
      'Time',
      'Stage',
      'Status',
      'Source',
      'Value USD',
      'Balance USD',
      'Follow-up',
      'Staff missing',
    ];
    rows = dated
      .filter((e) =>
        name === 'Leads' ? e.status === 'lead' : e.status !== 'lead',
      )
      .map((e) => [
        e.title,
        e.client,
        e.email,
        e.date,
        e.time,
        e.status,
        e.lifecycle || 'Active',
        e.source,
        e.total / 100,
        balance(e, data) / 100,
        e.follow_up,
        coverage(e, data).missing,
      ]);
  } else if (name === 'Payment History' || name === 'Tips') {
    headers = [
      'Payment date',
      'Event',
      'Client',
      'Method',
      'Reference',
      'Payment USD',
      'Tip USD',
      'Received USD',
    ];
    rows = payments
      .filter((p) => name !== 'Tips' || !!p.tip)
      .map((p) => {
        const e = events.find((e) => e.id === p.event_id)!;
        return [
          p.date,
          e.title,
          e.client,
          p.method,
          p.reference,
          p.amount / 100,
          (p.tip || 0) / 100,
          (p.amount + (p.tip || 0)) / 100,
        ];
      });
    note =
      'Filtered by payment date. Payments were recorded manually; tips do not reduce the event balance.';
  } else if (name === 'Balances') {
    headers = [
      'Event',
      'Client',
      'Event date',
      'Payment due',
      'Status',
      'Total USD',
      'Paid USD',
      'Balance USD',
    ];
    rows = dated
      .filter(
        (e) => activeEvent(e) && e.status !== 'lead' && balance(e, data) > 0,
      )
      .map((e) => [
        e.title,
        e.client,
        e.date,
        e.operations?.quote?.dueDate,
        e.status,
        e.total / 100,
        (e.total - balance(e, data)) / 100,
        balance(e, data) / 100,
      ]);
  } else if (name === 'Sales Tax') {
    headers = ['Event', 'Event date', 'Tax label', 'Billed tax USD'];
    rows = booked.map((e) => [
      e.title,
      e.date,
      e.operations?.quote?.taxLabel || 'Tax',
      (e.operations?.quote?.tax || 0) / 100,
    ]);
    note =
      'Tax on active confirmed booking quotes, filtered by event date. Jurisdiction breakdown and tax collected allocation are not tracked.';
  } else if (name === 'Expenses') {
    headers = [
      'Payee',
      'Expense date',
      'Category',
      'Reference',
      'Event',
      'Amount USD',
    ];
    rows = expenses.map((r) => [
      r.name,
      r.data.date,
      r.data.category,
      r.data.reference,
      data.events.find((e) => e.id === r.data.eventId)?.title || '',
      Number(r.data.amount),
    ]);
    note = 'Filtered by expense date. Archived expenses are excluded.';
  } else if (name === 'Profit & Loss') {
    headers = ['Measure', 'Amount USD'];
    const received = payments.reduce((n, p) => n + p.amount, 0),
      tips = payments.reduce((n, p) => n + (p.tip || 0), 0),
      costs = expenses.reduce(
        (n, r) => n + Math.round(Number(r.data.amount) * 100),
        0,
      );
    rows = [
      ['Recorded payments', received / 100],
      ['Recorded tips', tips / 100],
      ['Recorded expenses', costs / 100],
      ['Recorded receipts less expenses', (received + tips - costs) / 100],
    ];
    note =
      'Cash record summary by payment and expense date. This is not an accrual statement; tax liabilities, refunds, and unrecorded transactions are not included.';
  } else if (name === 'Most Frequently Booked' || name === 'Utilization') {
    const counts = new Map<
      string,
      { count: number; days: number; value: number }
    >();
    for (const e of booked) {
      let values: { key: string; label: string; value: number }[] = [];
      if (f.group === 'Staff')
        values = (e.operations?.staffIds || []).map((id) => ({
          key: id,
          label:
            data.resources?.find((r) => r.id === id)?.name || 'Archived staff',
          value: 0,
        }));
      else if (f.group === 'Customers')
        values = [
          { key: e.email, label: `${e.client} (${e.email})`, value: e.total },
        ];
      else if (f.group === 'Referrers')
        values = [
          {
            key: e.source || 'Not set',
            label: e.source || 'Not set',
            value: e.total,
          },
        ];
      else if (f.group === 'Add-ons' || f.group === 'Backdrops')
        values = (e.operations?.quote?.extras || [])
          .filter(
            (x) => x.kind === (f.group === 'Add-ons' ? 'addons' : 'backdrops'),
          )
          .map((x) => ({ key: x.id, label: x.name, value: x.price }));
      else
        values = e.items.map((x) => ({
          key: x.id,
          label: x.name,
          value: x.price,
        }));
      for (const x of values) {
        const key = x.key + '\0' + x.label,
          old = counts.get(key) || { count: 0, days: 0, value: 0 };
        counts.set(key, {
          count: old.count + 1,
          days: old.days + occupiedDates(e).length,
          value: old.value + x.value,
        });
      }
    }
    headers = [f.group, 'Bookings', 'Reserved days', 'Snapshot value USD'];
    rows = [...counts]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, v]) => [key.split('\0')[1], v.count, v.days, v.value / 100]);
    note =
      'Active confirmed bookings whose start date falls in the filter. Reserved days count each event’s full span, not a capacity percentage. Staff values exclude wages.';
  } else if (name === 'Client List') {
    const clients = new Map<string, EventRecord>();
    for (const e of dated) clients.set(e.email, e);
    headers = ['Client', 'Email', 'Phone', 'Records'];
    rows = [...clients.values()].map((e) => [
      e.client,
      e.email,
      e.phone,
      dated.filter((x) => x.email === e.email).length,
    ]);
    note =
      'Contacts from events within the selected dates. Staff and account administrators are managed separately.';
  } else if (name === 'Places') {
    headers = ['Venue / address', 'Events'];
    const venues = new Map<string, number>();
    for (const e of dated)
      if (e.venue) venues.set(e.venue, (venues.get(e.venue) || 0) + 1);
    rows = [...venues];
  } else if (name === 'Blockouts & Availability') {
    headers = ['Type', 'Name', 'From', 'To', 'Status'];
    rows = [
      ...String(data.settings?.blackoutDates || '')
        .split(/\s+/)
        .filter((d) => d && between(d))
        .map((d) => ['Business', 'Unavailable date', d, d, 'Unavailable']),
      ...salesRows(data, 'time_off')
        .filter(
          (r) =>
            (!f.from || r.data.end >= f.from) &&
            (!f.to || r.data.start <= f.to),
        )
        .map((r) => [
          'Staff',
          data.resources?.find((s) => s.id === r.data.staffId)?.name ||
            'Archived staff',
          r.data.start,
          r.data.end,
          r.data.status,
        ]),
    ];
    note =
      'Combined business blockout dates and recorded staff time off. Open Staff Availability for recurring weekly schedules.';
  } else if (name === 'Packages & Add-ons') {
    headers = ['Type', 'Name', 'Service / group', 'Price USD', 'Visibility'];
    rows = [
      ...data.packages.map((p) => [
        'Package',
        p.name,
        p.service,
        p.price / 100,
        p.settings?.status || 'Public',
      ]),
      ...(data.resources || [])
        .filter((r) => ['addons', 'backdrops'].includes(r.kind) && !r.archived)
        .map((r) => [r.kind, r.name, '', Number(r.data.price || 0), 'Active']),
    ];
    note =
      'Current catalog prices. Date filters do not apply to this catalog report.';
  } else if (name === 'Message History') {
    headers = ['Recorded date', 'Channel', 'Recipient', 'Subject', 'State'];
    rows = salesRows(data, 'message')
      .filter(
        (r) =>
          r.data.state.startsWith('Recorded') &&
          between(r.created_at.slice(0, 10)),
      )
      .map((r) => [
        r.created_at.slice(0, 10),
        r.data.channel,
        r.data.recipient,
        r.data.subject,
        r.data.state,
      ]);
    note =
      'Manually logged message exchanges, filtered by the date logged. Delivery events are not connected.';
  } else if (name === 'Email Event History') {
    note =
      'Email delivery, open, click, and bounce events require a delivery provider. Connection is deferred; no events are fabricated.';
  } else if (name === 'Login History') {
    note =
      'Sign-in is handled by the hosting platform. Its login audit history is not exposed to this workspace.';
  }
  const filtered = f.search
    ? rows.filter((r) =>
        r.some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(f.search.toLowerCase()),
        ),
      )
    : rows;
  return { headers, rows: filtered, note, columns: headers, error: '' };
}
