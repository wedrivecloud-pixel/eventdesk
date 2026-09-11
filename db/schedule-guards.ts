import { segments, type Window } from '@/lib/staff-scheduling';
import { eventEndSql } from './availability';
export const offStartSql =
  "ed_julian(ed_text(s.data,'$.start')||'T'||CASE WHEN ed_number(s.data,'$.allDay')=0 THEN ed_text(s.data,'$.startTime') ELSE '00:00' END)";
export const offEndSql =
  "ed_julian(ed_text(s.data,'$.end')||'T'||CASE WHEN ed_number(s.data,'$.allDay')=0 THEN ed_text(s.data,'$.endTime') ELSE '00:00' END)+CASE WHEN ed_number(s.data,'$.allDay')=0 THEN 0 ELSE 1 END";
const allDay =
  "(x.time='' OR EXISTS(SELECT 1 FROM ed_each(x.items) j WHERE ed_text(j.value,'$.packageSettings.dateMode')='Date Only'))";
const begins = `CASE WHEN ${allDay} THEN ed_julian(x.date) ELSE ed_julian(x.date||'T'||x.time) END`;
const ends = `CASE WHEN ${allDay} THEN ed_julian(${eventEndSql})+1 ELSE (${begins})+COALESCE((SELECT MAX(COALESCE(ed_number(j.value,'$.minutes'),ed_number(j.value,'$.packageSettings.includedMinutes'),240)+COALESCE(ed_number(j.value,'$.extraMinutes'),0)) FROM ed_each(x.items) j),240)/1440.0 END`;
// Each guard is evaluated inside the write, including overlapping appointment approvals.
export function scheduleGuard(
  bid: unknown,
  excluded: unknown,
  w: Window,
  ids: string[],
  options: {
    weekly?: boolean;
    bookings?: boolean | 'all';
    timeOff?: boolean;
    appointments?: boolean;
    buffer?: number;
  } = {},
) {
  const start = w.start / 86400000 + 2440587.5,
    end = w.end / 86400000 + 2440587.5,
    chosen = JSON.stringify(ids),
    sql: string[] = [],
    args: unknown[] = [];
  if (options.weekly !== false) {
    sql.push(
      "EXISTS(SELECT 1 FROM ed_each(?) picked WHERE picked.value!='owner' AND NOT EXISTS(SELECT 1 FROM resources r WHERE r.id=picked.value AND r.business_id=? AND r.kind='staff' AND r.archived=0))",
    );
    args.push(chosen, bid);
    sql.push(
      `EXISTS(SELECT 1 FROM resources r JOIN ed_each(?) picked ON picked.value=r.id CROSS JOIN ed_each(?) seg WHERE r.business_id=? AND r.kind='staff' AND (r.archived=1 OR ed_number(r.data,'$.staffRole')=0 OR EXISTS(SELECT 1 FROM ed_each(ed_text(r.data,'$.bookingAvailability')) d WHERE d.key=ed_text(seg.value,'$.day') AND (ed_text(d.value,'$.mode')='off' OR (ed_text(d.value,'$.mode')='hours' AND (ed_text(d.value,'$.start')>ed_text(seg.value,'$.start') OR ed_text(d.value,'$.end')<ed_text(seg.value,'$.end')))))))`,
    );
    args.push(chosen, JSON.stringify(segments(w)), bid);
  }
  if (options.bookings !== false) {
    sql.push(
      `EXISTS(SELECT 1 FROM events x LEFT JOIN event_operations o ON o.event_id=x.id AND o.business_id=x.business_id WHERE x.business_id=? AND x.id!=? AND x.status='confirmed' AND x.lifecycle='Active' AND ${options.bookings === 'all' ? 'TRUE' : "EXISTS(SELECT 1 FROM ed_each(ed_text(o.data,'$.staffIds')) a JOIN ed_each(?) b ON a.value=b.value)"} AND (${begins})<? AND (${ends})>?)`,
    );
    args.push(
      bid,
      excluded,
      ...(options.bookings === 'all' ? [] : [chosen]),
      end,
      start,
    );
  }
  if (options.timeOff !== false) {
    sql.push(
      `EXISTS(SELECT 1 FROM sales_records s WHERE s.business_id=? AND s.kind='time_off' AND s.archived=0 AND ed_text(s.data,'$.status')='Approved' AND ed_text(s.data,'$.staffId') IN(SELECT value FROM ed_each(?)) AND (${offStartSql})<? AND (${offEndSql})>?)`,
    );
    args.push(bid, chosen, end, start);
  }
  if (options.appointments !== false) {
    const a =
        "ed_julian(ed_text(s.data,'$.date')||'T'||ed_text(s.data,'$.time'))",
      gap = `GREATEST(COALESCE(ed_number(s.data,'$.buffer'),0),?)/1440.0`;
    sql.push(
      `EXISTS(SELECT 1 FROM sales_records s WHERE s.business_id=? AND s.id!=? AND s.kind='appointment' AND s.archived=0 AND ed_text(s.data,'$.status')='Scheduled' AND (ed_text(s.data,'$.organizer') IN(SELECT value FROM ed_each(?)) OR EXISTS(SELECT 1 FROM ed_each(ed_text(s.data,'$.staffIds')) a JOIN ed_each(?) b ON a.value=b.value)) AND (${a})-(${gap})<? AND (${a})+ed_number(s.data,'$.minutes')/1440.0+(${gap})>?)`,
    );
    args.push(
      bid,
      excluded,
      chosen,
      chosen,
      options.buffer || 0,
      end,
      options.buffer || 0,
      start,
    );
  }
  return { sql: sql.length ? '(' + sql.join(' OR ') + ')' : 'FALSE', args };
}
