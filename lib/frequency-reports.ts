import type { Data } from './crm';
import type { ReportFilter } from './sales-reports';
import { activeEvent } from './sales';
export const frequencyGroups = ['Packages', 'Add-ons', 'Backdrops', 'Staff', 'Customers', 'Referrers'];
export const frequencyColumns = (group: string) => group === 'Staff' ? ['Name', 'Bookings'] : ['Name', 'Bookings', ...(group === 'Add-ons' ? ['Quantity booked'] : []), group === 'Customers' || group === 'Referrers' ? 'Booking total incl. tax USD' : 'Snapshot value USD'];
export function buildFrequencyReport(data: Data, f: ReportFilter) {
  const group = frequencyGroups.includes(f.group) ? f.group : 'Packages', columns = frequencyColumns(group);
  const selected = columns.filter((c) => f.columns?.includes(c)), headers = selected.length ? selected : columns;
  const entries = new Map<string, { id: string; name: string; count: number; quantity: number; value: number; eventIds: string[] }>();
  const error = f.from && f.to && f.from > f.to ? 'The end date must be on or after the start date.' : '';
  for (const e of data.events.filter((e) => e.status === 'confirmed' && activeEvent(e) && (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to)).sort((a, b) => b.date.localeCompare(a.date))) {
    let values: { id: string; name: string; quantity: number; value: number }[];
    if (group === 'Customers') values = [{ id: e.email.trim().toLowerCase() || 'event:' + e.id, name: e.client + (e.email ? ` (${e.email.trim().toLowerCase()})` : ''), quantity: 1, value: e.total }];
    else if (group === 'Referrers') values = [{ id: e.source || 'Not set', name: e.source || 'Not set', quantity: 1, value: e.total }];
    else if (group === 'Staff') values = [...new Set(e.operations?.staffIds || [])].map((id) => ({ id, name: data.resources?.find((r) => r.kind === 'staff' && r.id === id)?.name || 'Removed staff', quantity: 1, value: 0 }));
    else if (group === 'Add-ons' || group === 'Backdrops') values = (e.operations?.quote?.extras || []).filter((x) => x.kind === (group === 'Add-ons' ? 'addons' : 'backdrops')).map((x) => ({ id: x.id, name: x.name, quantity: Math.max(1, Number(x.quantity) || 1), value: x.price || 0 }));
    else values = e.items.map((x) => ({ id: x.id, name: x.name, quantity: 1, value: x.price }));
    for (const x of values) {
      const row = entries.get(x.id) || { id: x.id, name: x.name, count: 0, quantity: 0, value: 0, eventIds: [] };
      if (!row.eventIds.includes(e.id)) { row.eventIds.push(e.id); row.count++; }
      row.quantity += x.quantity; row.value += x.value; entries.set(x.id, row);
    }
  }
  const frequencyEntries = error ? [] : [...entries.values()].filter((r) => r.name.toLowerCase().includes(f.search.trim().toLowerCase())).sort((a, b) => (group === 'Add-ons' ? b.quantity - a.quantity : b.count - a.count) || b.value - a.value || a.name.localeCompare(b.name));
  const rows = frequencyEntries.map((r) => { const values = [r.name, r.count, ...(group === 'Add-ons' ? [r.quantity] : []), ...(group === 'Staff' ? [] : [r.value / 100])]; return headers.map((h) => values[columns.indexOf(h)]); });
  const note = 'Active confirmed bookings by scheduled start date, updated from your current records. Each item counts once per booking; add-on quantities are summed separately. Item values use saved line amounts, not collected payments; customer totals include tax and adjustments. Customers are grouped by email, and staff counts do not represent wages or revenue.';
  return { headers, columns, rows, frequencyEntries, note, error };
}
