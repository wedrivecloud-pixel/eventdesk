import { date, type Data, type EventRecord } from './crm';
import { activeEvent, dateAdd } from './sales';

export const overviewWidgets = {
  revenue: 'Revenue Snapshot',
  upcoming: 'Upcoming Bookings',
  recent: 'Recently Booked',
  tools: 'Quick Actions & Tools',
  messages: 'Recent Messages',
  leads: 'Recent Leads',
  payments: 'Recent Payments',
  followups: 'Follow-ups Due',
  summary: 'Business Summary',
  services: 'Your Services',
} as const;
export type WidgetId = keyof typeof overviewWidgets;
export type DashboardWidget = {
  id: WidgetId;
  enabled: boolean;
  column: 'full' | 'main' | 'side';
  limit: number;
  hideEmpty: boolean;
};
export type DashboardLayout = { widgets: DashboardWidget[] };
export function defaultDashboard(): DashboardLayout {
  return {
    widgets: Object.keys(overviewWidgets).map((id) => ({
      id: id as WidgetId,
      enabled: true,
      column: ['revenue', 'summary'].includes(id)
        ? 'full'
        : ['upcoming', 'recent', 'followups'].includes(id)
          ? 'main'
          : 'side',
      limit: id === 'upcoming' ? 5 : 3,
      hideEmpty: false,
    })),
  };
}
export function checkedDashboard(input: unknown): DashboardLayout {
  if (
    !input ||
    typeof input !== 'object' ||
    !Array.isArray((input as DashboardLayout).widgets)
  )
    throw Error('Choose valid dashboard widgets.');
  const widgets = (input as DashboardLayout).widgets;
  if (
    widgets.length !== Object.keys(overviewWidgets).length ||
    new Set(widgets.map((w) => w.id)).size !== widgets.length
  )
    throw Error('Include each dashboard widget once.');
  return {
    widgets: widgets.map((w) => {
      if (
        !Object.hasOwn(overviewWidgets, w.id) ||
        !['full', 'main', 'side'].includes(w.column) ||
        typeof w.enabled !== 'boolean' ||
        typeof w.hideEmpty !== 'boolean' ||
        !Number.isInteger(w.limit) ||
        w.limit < 1 ||
        w.limit > 50
      )
        throw Error('Choose valid widget settings (1–50 results).');
      return {
        id: w.id,
        enabled: w.enabled,
        column: w.column,
        limit: w.limit,
        hideEmpty: w.hideEmpty,
      };
    }),
  };
}
export const revenueRanges = [
  'This month',
  'Last 7 days',
  'Last 4 weeks',
  'Last 3 months',
  'Last 12 months',
  'Month to date',
  'Quarter to date',
  'Year to date',
  'Last year',
  'This year',
  'Next year',
  '+/- 3 Months',
  'Custom',
];
export const revenueGroups = [
  'Day',
  'Week',
  'Month',
  'Quarter',
  'Year',
] as const;
export type RevenueGroup = (typeof revenueGroups)[number];
export type RevenueBasis = 'Scheduled' | 'Payment' | 'Booked';
export type RevenueFilter = {
  basis: RevenueBasis;
  range: string;
  group: RevenueGroup;
  from: string;
  to: string;
};
const monthDay = (day: string, offset: number, last = false) => {
  const [y, m] = day.split('-').map(Number);
  return new Date(
    Date.UTC(y, m - 1 + offset + (last ? 1 : 0), last ? 0 : 1, 12),
  )
    .toISOString()
    .slice(0, 10);
};
export function revenuePeriod(
  range: string,
  today: string,
  from = '',
  to = '',
) {
  const year = Number(today.slice(0, 4)),
    month = Number(today.slice(5, 7));
  let first = today,
    last = today;
  if (range === 'Last 7 days') first = dateAdd(today, -6);
  else if (range === 'Last 4 weeks') first = dateAdd(today, -27);
  else if (range === 'Last 3 months' || range === 'Last 12 months') {
    first = monthDay(today, range === 'Last 3 months' ? -2 : -11);
    last = monthDay(today, 0, true);
  } else if (range === 'This month') {
    first = monthDay(today, 0);
    last = monthDay(today, 0, true);
  } else if (range === 'Month to date') first = monthDay(today, 0);
  else if (range === 'Quarter to date')
    first = monthDay(today, -((month - 1) % 3));
  else if (range === 'Year to date') first = year + '-01-01';
  else if (['Last year', 'This year', 'Next year'].includes(range)) {
    const y =
      year + (range === 'Last year' ? -1 : range === 'Next year' ? 1 : 0);
    first = y + '-01-01';
    last = y + '-12-31';
  } else if (range === '+/- 3 Months') {
    first = monthDay(today, -3);
    last = monthDay(today, 3, true);
  } else if (range === 'Custom') {
    first = date(from, 'Start date');
    last = date(to, 'End date');
  } else throw Error('Choose a date range.');
  if (first > last) throw Error('End date must be on or after start date.');
  if (Date.parse(last) - Date.parse(first) > 3660 * 86400000)
    throw Error('Choose a date range of ten years or less.');
  return { from: first, to: last };
}
export function businessDay(value: string, timezone: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
        new Date(timestamp),
      )
    : '';
}
export const bookedAt = (e: EventRecord) =>
  e.operations?.sales?.confirmedAt || e.created_at;
export const recentlyBooked = (data: Data) =>
  data.events
    .filter((e) => e.status === 'confirmed' && activeEvent(e))
    .slice()
    .sort(
      (a, b) =>
        bookedAt(b).localeCompare(bookedAt(a)) || b.id.localeCompare(a.id),
    );
export function overdueBalance(e: EventRecord, paid: number, today: string) {
  const schedule = e.operations?.paymentPlan?.schedule;
  const due = schedule?.length
    ? schedule.filter((p) => p.date < today).reduce((n, p) => n + p.amount, 0)
    : (e.operations?.quote?.dueDate || e.date) < today
      ? e.total
      : 0;
  return Math.min(Math.max(0, e.total - paid), Math.max(0, due - paid));
}
const bucketKey = (day: string, group: RevenueGroup) => {
  if (group === 'Day') return day;
  if (group === 'Week')
    return dateAdd(day, -((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7));
  if (group === 'Month') return day.slice(0, 7) + '-01';
  if (group === 'Quarter')
    return (
      day.slice(0, 4) +
      '-' +
      String(Math.floor((Number(day.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(
        2,
        '0',
      ) +
      '-01'
    );
  return day.slice(0, 4) + '-01-01';
};
const bucketLabel = (day: string, group: RevenueGroup) =>
  group === 'Year'
    ? day.slice(0, 4)
    : group === 'Quarter'
      ? 'Q' +
        (Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1) +
        ' ' +
        day.slice(0, 4)
      : group === 'Month'
        ? new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : (group === 'Week' ? 'Week of ' : '') + day;
export type RevenueBucket = {
  key: string;
  label: string;
  from: string;
  to: string;
  paid: number;
  projected: number;
  postponed: number;
  pastDue: number;
  total: number;
  count: number;
  entries: RevenueEntry[];
};
export type RevenueEntry = {
  event: EventRecord;
  date: string;
  bookedDate: string;
  paid: number;
  projected: number;
  postponed: number;
  pastDue: number;
  total: number;
  paymentId?: string;
  method?: string;
};
export function revenueSnapshot(
  data: Data,
  filter: RevenueFilter,
  today: string,
) {
  const period = revenuePeriod(filter.range, today, filter.from, filter.to),
    zone = String(data.settings?.timezone || 'America/Los_Angeles');
  const buckets = new Map<string, RevenueBucket>();
  let cursor = bucketKey(period.from, filter.group);
  while (cursor <= period.to) {
    if (buckets.size >= 400)
      throw Error(
        'Choose a larger Group By interval for this date range (up to 400 groups).',
      );
    const next =
      filter.group === 'Day'
        ? dateAdd(cursor, 1)
        : filter.group === 'Week'
          ? dateAdd(cursor, 7)
          : monthDay(
              cursor,
              filter.group === 'Month'
                ? 1
                : filter.group === 'Quarter'
                  ? 3
                  : 12,
            );
    buckets.set(cursor, {
      key: cursor,
      label: bucketLabel(cursor, filter.group),
      from: cursor < period.from ? period.from : cursor,
      to: dateAdd(next, -1) > period.to ? period.to : dateAdd(next, -1),
      paid: 0,
      projected: 0,
      postponed: 0,
      pastDue: 0,
      total: 0,
      count: 0,
      entries: [],
    });
    cursor = next;
  }
  const between = (s: string) => s && s >= period.from && s <= period.to;
  const eventMap = new Map(data.events.map((e) => [e.id, e]));
  const paidMap = new Map<string, number>();
  for (const p of data.payments || [])
    paidMap.set(p.event_id, (paidMap.get(p.event_id) || 0) + p.amount);
  const paymentEvents = new Set<string>();
  let fallbackCount = 0;
  if (filter.basis === 'Payment') {
    for (const p of data.payments || []) {
      const event = eventMap.get(p.event_id);
      if (
        !event ||
        event.lifecycle === 'Deleted' ||
        event.lifecycle === 'Spam' ||
        !between(p.date)
      )
        continue;
      const b = buckets.get(bucketKey(p.date, filter.group))!;
      b.paid += p.amount;
      b.total += p.amount;
      b.entries.push({
        event,
        date: p.date,
        bookedDate: businessDay(bookedAt(event), zone),
        paid: p.amount,
        total: p.amount,
        projected: 0,
        postponed: 0,
        pastDue: 0,
        paymentId: p.id,
        method: p.method,
      });
      paymentEvents.add(p.event_id);
    }
  } else {
    for (const e of data.events) {
      if (
        e.status !== 'confirmed' ||
        !(activeEvent(e) || e.lifecycle === 'Postponed')
      )
        continue;
      const day =
        filter.basis === 'Scheduled' ? e.date : businessDay(bookedAt(e), zone);
      if (!between(day)) continue;
      const b = buckets.get(bucketKey(day, filter.group))!,
        paid = Math.min(e.total, Math.max(0, paidMap.get(e.id) || 0)),
        remaining = Math.max(0, e.total - paid);
      if (filter.basis === 'Booked' && !e.operations?.sales?.confirmedAt)
        fallbackCount++;
      const pastDue =
          e.lifecycle === 'Postponed' ? 0 : overdueBalance(e, paid, today),
        postponed = e.lifecycle === 'Postponed' ? remaining : 0;
      b.paid += paid;
      b.pastDue += pastDue;
      b.postponed += postponed;
      b.projected += remaining - pastDue - postponed;
      b.total += e.total;
      b.count++;
      b.entries.push({
        event: e,
        date: day,
        bookedDate: businessDay(bookedAt(e), zone),
        paid,
        projected: remaining - pastDue - postponed,
        postponed,
        pastDue,
        total: e.total,
      });
    }
  }
  const rows = [...buckets.values()];
  for (const row of rows) {
    if (filter.basis === 'Payment')
      row.count = new Set(row.entries.map((entry) => entry.event.id)).size;
    row.entries.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id),
    );
  }
  const total = rows.reduce(
    (a, b) => ({
      paid: a.paid + b.paid,
      projected: a.projected + b.projected,
      postponed: a.postponed + b.postponed,
      pastDue: a.pastDue + b.pastDue,
      total: a.total + b.total,
      count: a.count + b.count,
    }),
    { paid: 0, projected: 0, postponed: 0, pastDue: 0, total: 0, count: 0 },
  );
  if (filter.basis === 'Payment') total.count = paymentEvents.size;
  return {
    period,
    rows,
    total,
    average: total.count ? Math.round(total.total / total.count) : 0,
    fallbackCount,
  };
}
