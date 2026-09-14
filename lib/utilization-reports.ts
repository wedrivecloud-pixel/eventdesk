import type { Data, EventRecord } from './crm';
import type { ReportFilter } from './sales-reports';
import { activeEvent, localToday, salesRows } from './sales';
import { eventWindow, windowsOverlap } from './staffing';
import { appointmentWindow, timeOffWindow, weekFor } from './staff-scheduling';
import { appliesTo } from './manage-config';

export const utilizationGroups = ['Packages', 'Add-ons', 'Backdrops', 'Bundles', 'Staff'];
export const utilizationSorts = ['Name (A–Z)', 'Reserved (highest first)'];
export const utilizationColumns = ['Name', 'Group', 'Reserved', 'Peak concurrent', 'Limit', 'Status'];
type Reservation = { id: string; kind: 'booking' | 'appointment'; title: string; start: number; end: number; quantity: number };
export type UtilizationEntry = { id: string; name: string; group: string; reserved: number; peak: number; limit: string | number; status: string; reservations: Reservation[] };
export function peakReserved(ranges: Reservation[], start: number, end: number) {
  const points = ranges.flatMap((r) => r.start < end && r.end > start ? [[Math.max(start, r.start), r.quantity], [Math.min(end, r.end), -r.quantity]] : []);
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let used = 0, peak = 0;
  for (const [, delta] of points) { used += delta; peak = Math.max(peak, used); }
  return peak;
}
export function buildUtilizationReport(data: Data, f: ReportFilter) {
  const day = f.utilizationDate ?? localToday(data), start = Date.parse(day + 'T00:00:00Z'), end = start + 86400000;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(start) && new Date(start).toISOString().slice(0, 10) === day;
  const group = utilizationGroups.includes(f.group) ? f.group : 'Packages';
  const columns = utilizationColumns, selected = columns.filter((c) => f.columns?.includes(c));
  const headers = selected.length ? selected : columns;
  const resources = data.resources || [], rules = resources.filter((r) => r.kind === 'inventory_rules' && !r.archived);
  const reservations: { event: EventRecord; reservation: Reservation }[] = [];
  let invalidSchedules = 0;
  if (valid) for (const event of data.events.filter((e) => e.status === 'confirmed' && activeEvent(e))) {
    try { const w = eventWindow(event); if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) { invalidSchedules++; continue; } if (windowsOverlap(w, { start, end })) reservations.push({ event, reservation: { ...w, id: event.id, kind: 'booking', title: event.title, quantity: 1 } }); } catch { invalidSchedules++; }
  }
  const entry = (id: string, name: string, category: string, matches: (e: EventRecord) => number, limit: string | number = 'Not configured', state = ''): UtilizationEntry => {
    const rows = reservations.flatMap(({ event, reservation }) => { const quantity = matches(event); return quantity > 0 ? [{ ...reservation, quantity }] : []; });
    const peak = peakReserved(rows, start, end);
    return { id, name, group: category, reserved: rows.reduce((n, r) => n + r.quantity, 0), peak, limit, status: state || (typeof limit === 'number' ? peak > limit ? 'Over limit' : peak === limit ? 'At limit during day' : 'Below limit' : 'No capacity limit configured'), reservations: rows };
  };
  let entries: UtilizationEntry[] = [];
  const bundled = (e: EventRecord, id: string) => e.items.some((i) => i.id === id && (i.packageSettings?.includedAddonIds?.length || e.operations?.quote?.extras?.some((x) => x.included && x.packageId === id)));
  if (group === 'Packages' || group === 'Bundles') entries = data.packages.filter((p) => group !== 'Bundles' || p.settings?.includedAddonIds?.length || reservations.some(({ event }) => bundled(event, p.id))).map((p) => {
    const category = group === 'Bundles' ? 'Package with included add-ons' : [p.service, p.settings?.group].filter(Boolean).join(' / ');
    const r = entry(p.id, p.name, category, (e) => (group === 'Bundles' ? bundled(e, p.id) : e.items.some((i) => i.id === p.id)) ? 1 : 0);
    const shared = rules.filter((rule) => appliesTo(rule, [p.id]));
    if (shared.length) {
      r.limit = shared.map((rule) => `${rule.name}: ${Number(rule.data.capacity || 1)} shared`).join('; ');
      const levels = shared.map((rule) => { const pool = entry(rule.id, rule.name, '', (e) => appliesTo(rule, e.items.map((i) => i.id)) ? 1 : 0, Number(rule.data.capacity || 1)); return pool.peak > Number(rule.data.capacity || 1) ? 2 : pool.peak === Number(rule.data.capacity || 1) ? 1 : 0; });
      r.status = levels.includes(2) ? 'Shared pool over limit' : levels.includes(1) ? 'Shared pool at limit during day' : 'Shared pool below limit';
    }
    if (p.settings?.status === 'Disabled') r.status = 'Disabled';
    return r;
  });
  if (group === 'Add-ons' || group === 'Backdrops') {
    const kind = group === 'Add-ons' ? 'addons' : 'backdrops';
    const catalog = new Map(resources.filter((r) => r.kind === kind).map((r) => [r.id, { name: r.name, category: resources.find((c) => c.id === r.data.categoryId && c.kind === 'categories')?.name || 'Uncategorized', archived: !!r.archived }]));
    for (const { event } of reservations) for (const x of event.operations?.quote?.extras || []) if (x.kind === kind && !catalog.has(x.id)) catalog.set(x.id, { name: x.name, category: 'Removed item', archived: true });
    entries = [...catalog].map(([id, c]) => entry(id, c.name, c.category, (e) => {
      const extras = (e.operations?.quote?.extras || []).filter((x) => x.id === id && x.kind === kind);
      if (extras.length) return extras.reduce((n, x) => n + Math.max(1, Number(x.quantity) || 1), 0);
      return kind === 'backdrops' && e.operations?.quote?.backdropId === id ? 1 : 0;
    }, 'Not configured', c.archived ? 'Archived / removed' : '')).filter((r) => !catalog.get(r.id)?.archived || r.reserved > 0);
  }
  if (group === 'Staff') entries = resources.filter((r) => r.kind === 'staff').map((s) => {
    const r = entry(s.id, s.name, 'Staff', (e) => e.operations?.staffIds?.includes(s.id) ? 1 : 0, 1);
    for (const a of salesRows(data, 'appointment').filter((a) => a.data.status === 'Confirmed' && a.data.staffId === s.id)) {
      const w = appointmentWindow(a.data); if (windowsOverlap(w, { start, end })) r.reservations.push({ ...w, id: a.id, kind: 'appointment', title: a.data.title || 'Appointment', quantity: 1 });
    }
    r.reserved = r.reservations.length; r.peak = peakReserved(r.reservations, start, end);
    const status = [r.peak > 1 ? 'Overlapping assignments' : r.reserved ? 'Assigned during day' : 'No assignments'];
    try { const hours = weekFor(s.data.bookingAvailability)[new Date(start).getUTCDay()]; status.push(hours.mode === 'off' ? 'Weekly day off' : hours.mode === 'hours' ? `Working ${hours.start}–${hours.end}` : 'All-day schedule'); } catch { status.push('Schedule needs review'); }
    if (salesRows(data, 'time_off').some((t) => t.data.staffId === s.id && (t.data.status || 'Approved') === 'Approved' && windowsOverlap(timeOffWindow(t.data), { start, end }))) status.push('Approved time off');
    if (s.archived) status.push('Archived'); r.status = status.join('; '); return r;
  }).filter((r) => !resources.find((s) => s.id === r.id)?.archived || r.reserved > 0);
  const search = f.search.trim().toLowerCase();
  entries = entries.filter((r) => !search || [r.name, r.group, r.status].some((v) => v.toLowerCase().includes(search)));
  entries.sort((a, b) => (f.sort === 'Reserved (highest first)' ? b.reserved - a.reserved : 0) || a.name.localeCompare(b.name));
  const values = (r: UtilizationEntry) => [r.name, r.group, r.reserved, r.peak, r.limit, r.status];
  const note = (group === 'Bundles' ? 'Bundles here means packages with automatically included add-ons, configured under Package → Advanced. Counts use the booking’s saved package settings, not newly added inclusions. These are not combinations of separate packages. ' : '') + `Reservations overlapping ${day}. Packages count confirmed bookings; extras count reserved quantities; staff include confirmed appointments. Peak concurrent measures overlap, not the daily total. Shared package limits use availability rules; per-booking quantity limits are not inventory capacity. This report does not guarantee availability for a new booking.` + (invalidSchedules ? ` ${invalidSchedules} confirmed booking(s) have invalid schedules and were excluded; review them before relying on these counts.` : '');
  return { headers, rows: valid ? entries.map((r) => headers.map((h) => values(r)[columns.indexOf(h)])) : [], columns, entries: valid ? entries : [], note, error: valid ? '' : 'Choose a valid utilization date.' };
}
