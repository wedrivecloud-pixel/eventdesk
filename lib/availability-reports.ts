import type { Data } from './crm';
import type { ReportFilter } from './sales-reports';
import { days, weekFor } from './staff-scheduling';
import { salesRows } from './sales';

export const availabilityReports = ['Business Blockout Dates', 'Staff Time Off', 'Staff Availability'];
export const availabilitySorts = ['Start (oldest first)', 'Start (newest first)', 'Entered (oldest first)', 'Entered (newest first)', 'Staff (A–Z)', 'Staff (Z–A)'];
export const availabilityColumns = (name: string) => name === 'Staff Availability'
  ? ['Staff member', ...days]
  : name === 'Staff Time Off'
    ? ['Staff member', 'Start', 'End', 'All day', 'Reason', 'Status', 'Entered at']
    : ['Start date', 'End date', 'All day'];

export function buildAvailabilityReport(data: Data, name: string, f: ReportFilter) {
  const columns = availabilityColumns(name), weekly = name === 'Staff Availability';
  const timezone = String(data.settings?.timezone || 'America/Los_Angeles');
  let error = '';
  if (!weekly && f.from && f.to && f.from > f.to) error = 'The end date must be on or after the start date.';
  if (name === 'Staff Time Off' && f.enteredFrom && f.enteredTo && f.enteredFrom > f.enteredTo) error = 'The entered-to date must be on or after the entered-from date.';
  const staff = (data.resources || []).filter((r) => r.kind === 'staff');
  const staffLabel = (id: string) => {
    const member = staff.find((r) => r.id === id);
    return member ? member.name + (member.archived ? ' (archived)' : '') : 'Unavailable staff';
  };
  const stamp = (value: string) => {
    const date = new Date(value);
    if (!value || !Number.isFinite(date.getTime())) return { date: '', label: '' };
    return {
      date: new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date),
      label: new Intl.DateTimeFormat('en-US', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(date),
    };
  };
  type Row = { values: string[]; staff: string; start: string; entered: string };
  let entries: Row[] = [];
  if (weekly) {
    entries = staff.filter((s) => !s.archived && (!f.staffId || s.id === f.staffId)).map((s) => {
      let hours: string[];
      try {
        hours = weekFor(s.data.bookingAvailability).map((d) => d.mode === 'all' ? 'Available all day' : d.mode === 'off' ? 'Unavailable' : `${d.start} – ${d.end}`);
      } catch {
        hours = days.map(() => 'Needs review');
      }
      return { values: [s.name, ...hours], staff: s.name, start: '', entered: '' };
    });
  } else if (name === 'Staff Time Off') {
    entries = salesRows(data, 'time_off').filter((r) =>
      (!f.staffId || r.data.staffId === f.staffId) &&
      (!f.timeOffStatus || f.timeOffStatus === 'All' || r.data.status === f.timeOffStatus) &&
      (!f.from || r.data.end >= f.from) && (!f.to || r.data.start <= f.to)
    ).filter((r) => {
      const entered = stamp(r.created_at).date;
      return (!f.enteredFrom || entered >= f.enteredFrom) && (!f.enteredTo || (!!entered && entered <= f.enteredTo));
    }).map((r) => {
      const d = r.data, allDay = d.allDay !== false;
      return { values: [staffLabel(d.staffId), d.start + (allDay ? '' : ' ' + d.startTime), d.end + (allDay ? '' : ' ' + d.endTime), allDay ? 'Yes' : 'No', d.notes || '', d.status || 'Approved', stamp(r.created_at).label], staff: staffLabel(d.staffId), start: d.start + ' ' + (allDay ? '00:00' : d.startTime), entered: r.created_at };
    });
  } else {
    entries = [...new Set(String(data.settings?.blackoutDates || '').split(/\s+/))]
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && (!f.from || d >= f.from) && (!f.to || d <= f.to))
      .map((d) => ({ values: [d, d, 'Yes'], start: d, staff: '', entered: '' }));
  }
  const sort = f.sort || (weekly ? 'Staff (A–Z)' : 'Start (oldest first)');
  const key = weekly || sort.startsWith('Staff') ? 'staff' : sort.startsWith('Entered') ? 'entered' : 'start';
  const reverse = sort.includes('newest') || sort.includes('Z–A') ? -1 : 1;
  entries.sort((a, b) => reverse * a[key].localeCompare(b[key]) || a.staff.localeCompare(b.staff));
  const search = f.search.trim().toLowerCase();
  const selected = f.columns?.length ? columns.filter((c) => f.columns!.includes(c)) : columns;
  const headers = selected.length ? selected : columns;
  const rows = error ? [] : entries.filter((r) => !search || r.values.some((v) => v.toLowerCase().includes(search))).map((r) => headers.map((h) => r.values[columns.indexOf(h)]));
  const note = weekly
    ? 'Recurring booking availability for active staff. Times use the business time zone (' + timezone + '). Time off, assigned bookings and appointments can further limit availability on a specific date. Staff without a custom schedule use the existing all-day default.'
    : name === 'Staff Time Off'
      ? 'Time off overlapping the selected dates. All-day end dates are inclusive; only approved time off blocks assignments. Archived entries are excluded. Times and entered dates use ' + timezone + '.'
      : 'All-day business blockout dates from Business settings → Availability. Date filters are inclusive. Reasons and entry timestamps are not recorded for these dates.';
  return { headers, rows, note, columns, error };
}
