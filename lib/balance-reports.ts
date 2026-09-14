import type { Data, EventRecord } from './crm';
import type { ReportFilter } from './sales-reports';
import { activeEvent, localToday } from './sales';

export const balanceReports = ['Outstanding Balances', 'Scheduled Payments'];
export const balanceSorts = ['Due date (oldest first)', 'Due date (newest first)', 'Balance (highest first)', 'Event (A–Z)'];
export function balanceColumns(name: string) {
  return name === 'Scheduled Payments'
    ? ['Due date', 'Event', 'Client', 'Payment type', 'Event date', 'Amount due USD', 'Amount remaining USD', 'Auto pay']
    : ['Due date', 'Event date', 'Event', 'Client', 'Status', 'Venue', 'Deposit outstanding USD', 'Total USD', 'Paid USD', 'Balance USD', 'Days past due'];
}
const cents = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));
// Recorded payments have no installment link. Allocate oldest due first, before filtering.
export function remainingSchedule(e: EventRecord, paid: number) {
  let unallocated = cents(e.total), credit = cents(paid);
  const due = e.operations?.quote?.dueDate || e.date;
  const schedule = [...(e.operations?.paymentPlan?.schedule || [])].sort((a, b) => a.date.localeCompare(b.date));
  const rows: { date: string; label: string; type: string; amount: number; remaining: number }[] = [];
  const add = (date: string, label: string, type: string, raw: number) => {
    const amount = Math.min(unallocated, cents(raw)), applied = Math.min(credit, amount);
    unallocated -= amount; credit -= applied;
    if (amount) rows.push({ date, label, type, amount, remaining: amount - applied });
  };
  for (const s of schedule) add(s.date, s.label, 'Scheduled Payment', s.amount);
  if (unallocated) add(due, 'Final balance', 'Final Balance', unallocated);
  return rows;
}
export function buildBalanceReport(data: Data, name: string, f: ReportFilter, today = localToday(data)) {
  const scheduled = name === 'Scheduled Payments', columns = balanceColumns(name);
  const headers = columns.filter(c => !f.columns?.length || f.columns.includes(c));
  const range = (day: string, from = '', to = '') => (!from || !!day && day >= from) && (!to || !!day && day <= to);
  let error = '';
  if (f.from && f.to && f.from > f.to || f.dueFrom && f.dueTo && f.dueFrom > f.dueTo) error = 'The end date must be on or after the start date.';
  const numeric = [f.minAmount, f.maxAmount].filter(v => v !== undefined && v !== '');
  if (numeric.some(v => !Number.isFinite(Number(v)) || Number(v) < 0)) error = 'Enter a valid nonnegative amount.';
  if (f.minAmount && f.maxAmount && Number(f.minAmount) > Number(f.maxAmount)) error = 'Maximum amount must be at least the minimum.';
  const paidByEvent = new Map<string, number>();
  for (const p of data.payments || []) if (!p.voided_at) paidByEvent.set(p.event_id, (paidByEvent.get(p.event_id) || 0) + cents(p.amount));
  const entries: { eventId: string; due: string; amount: number; cells: Record<string, string | number> }[] = [];
  for (const e of error ? [] : data.events) {
    if (!activeEvent(e) || e.status === 'lead' || !range(e.date, f.from, f.to)) continue;
    const status = f.status && !['All', 'Active'].includes(f.status) ? f.status : 'confirmed';
    if (e.status !== status || f.service && !e.items.some(p => p.service === f.service)) continue;
    const hasPlan = !!e.operations?.paymentPlan?.schedule?.length;
    if (f.hasPlan === 'Yes' && !hasPlan || f.hasPlan === 'No' && hasPlan) continue;
    const paid = paidByEvent.get(e.id) || 0, remaining = Math.max(0, e.total - paid);
    if (!remaining) continue;
    const schedule = remainingSchedule(e, paid);
    const daysPast = (day: string) => day ? Math.max(0, Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 86400000)) : 0;
    const append = (due: string, amount: number, cells: Record<string, string | number>) => {
      if (!range(due, f.dueFrom, f.dueTo) || f.dueStatus === 'Past due' && (!due || due >= today) || f.dueStatus === 'Due today' && due !== today || f.dueStatus === 'Upcoming' && (!due || due <= today)) return;
      if (f.minAmount && amount < Number(f.minAmount) * 100 || f.maxAmount && amount > Number(f.maxAmount) * 100) return;
      if (f.search && ![...Object.values(cells), e.email, e.phone].join(' ').toLowerCase().includes(f.search.trim().toLowerCase())) return;
      entries.push({ eventId: e.id, due, amount, cells });
    };
    if (scheduled) {
      for (const s of schedule) if (s.remaining && (!f.paymentType || f.paymentType === 'All' || f.paymentType === s.type)) append(s.date, s.remaining, {
        'Due date': s.date || 'Not set', Event: e.title, Client: e.client, 'Payment type': s.type === 'Final Balance' ? s.type : s.label, 'Event date': e.date,
        'Amount due USD': s.amount / 100, 'Amount remaining USD': s.remaining / 100, 'Auto pay': 'Not connected',
      });
    } else {
      const due = schedule.find(s => s.remaining > 0)?.date || e.operations?.quote?.dueDate || e.date;
      append(due, remaining, { 'Due date': due || 'Not set', 'Event date': e.date, Event: e.title, Client: e.client, Status: e.status === 'confirmed' ? 'Confirmed' : 'Proposal', Venue: e.venue,
        'Deposit outstanding USD': Math.min(remaining, Math.max(0, cents(e.deposit) - paid)) / 100, 'Total USD': e.total / 100, 'Paid USD': paid / 100, 'Balance USD': remaining / 100, 'Days past due': daysPast(due) });
    }
  }
  entries.sort((a,b) => (f.sort === 'Balance (highest first)' ? b.amount - a.amount : f.sort === 'Event (A–Z)' ? String(a.cells.Event).localeCompare(String(b.cells.Event)) : f.sort === 'Due date (newest first)' ? b.due.localeCompare(a.due) : (a.due || '9999').localeCompare(b.due || '9999')) || a.eventId.localeCompare(b.eventId));
  const totals = Object.fromEntries(columns.filter(c => c.endsWith(' USD')).map(c => [c, Math.round(entries.reduce((sum,e) => sum + Number(e.cells[c] || 0) * 100, 0)) / 100]));
  return { columns, headers, rows: entries.map(e => headers.map(c => e.cells[c])), balanceEventIds: entries.map(e => e.eventId), totals, error,
    note: scheduled
      ? 'Unpaid installments from saved payment plans, plus any final balance not covered by a plan. Recorded payments apply to the earliest installment first; tips and voided payments are excluded. Amount filters use the remaining amount. Auto pay is not connected.'
      : 'Unpaid active confirmed bookings by default; choose Proposals to review unaccepted quotes separately. Due date is the next unpaid installment or final balance date. Tips and voided payments are excluded. Totals reflect the current filters.' };
}
