import { rawDb } from './raw';
import { configuration } from './store';
import { text, date } from '@/lib/crm';
import {
  checkedCalendar,
  checkedWeek,
  weekFor,
  weeklyAllows,
  appointmentWindow,
  checkedTime,
  zonedInstant,
  type AppointmentCalendar,
} from '@/lib/staff-scheduling';
import { scheduleGuard } from './schedule-guards';
import { eventWindow, windowsOverlap } from '@/lib/staffing';
import { timeOffWindow } from '@/lib/staff-scheduling';
export async function schedulingStaff(bid: unknown, id: unknown) {
  const row = await rawDb()
    .prepare(
      "SELECT * FROM resources WHERE id=? AND business_id=? AND kind='staff' AND archived=0 AND COALESCE(ed_number(data,'$.staffRole'),1)=1",
    )
    .bind(text(id, 'Staff ID', 100), bid)
    .first<any>();
  if (!row) throw Error('Staff member unavailable.');
  return { ...row, data: JSON.parse(row.data) };
}
export async function calendarContext(
  staffId: string,
  calendarId: string,
  bid?: unknown,
) {
  const staff = await rawDb()
    .prepare(
      "SELECT id,name,business_id,data FROM resources WHERE id=? AND kind='staff' AND archived=0 AND COALESCE(ed_number(data,'$.staffRole'),1)=1",
    )
    .bind(staffId)
    .first<any>();
  if (!staff || (bid && staff.business_id !== bid))
    throw Error('Scheduling is unavailable.');
  const row = await rawDb()
    .prepare(
      "SELECT id,name,data FROM resources WHERE id=? AND business_id=? AND kind='appointment_calendars' AND archived=0 AND ed_text(data,'$.staffId')=?",
    )
    .bind(calendarId, staff.business_id, staffId)
    .first<any>();
  if (!row) throw Error('Scheduling calendar unavailable.');
  const record = JSON.parse(row.data),
    calendar = checkedCalendar(record.config);
  if (!calendar.enabled) throw Error('This scheduling calendar is paused.');
  const settingsRow = await rawDb()
      .prepare('SELECT data FROM business_settings WHERE business_id=?')
      .bind(staff.business_id)
      .first<{ data: string }>(),
    settings = JSON.parse(settingsRow?.data || '{}');
  return {
    bid: staff.business_id as string,
    staffId,
    staffName: staff.name as string,
    staffData: JSON.parse(staff.data),
    staffRecord: staff.data as string,
    id: row.id as string,
    name: row.name as string,
    record: row.data as string,
    calendar,
    settings,
    settingsRecord: settingsRow?.data || '{}',
    zone: String(settings.timezone || 'America/Los_Angeles'),
  };
}
type Context = Awaited<ReturnType<typeof calendarContext>>;
function checkWindow(c: Context, day: string, time: string, notice = true) {
  date(day, 'Appointment date');
  checkedTime(time);
  const w = appointmentWindow({ date: day, time, minutes: c.calendar.minutes });
  if (
    !weeklyAllows(
      c.calendar.sameWeek
        ? weekFor(c.staffData.bookingAvailability)
        : c.calendar.week,
      w,
    )
  )
    throw Error('This time is outside appointment availability.');
  const instant = zonedInstant(day, time, c.zone);
  if (!Number.isFinite(instant))
    throw Error('This local time does not exist. Choose another time.');
  const now = Date.now();
  if (!notice && instant < now)
    throw Error('This appointment time is in the past. Choose a future time.');
  if (notice && instant < now + c.calendar.notice * 60000)
    throw Error('This time does not meet the minimum notice.');
  if (
    c.calendar.maxDays !== null &&
    instant > now + c.calendar.maxDays * 86400000
  )
    throw Error('This date is beyond the booking window.');
  if (c.calendar.blockouts === 'All blockout dates') {
    const dates = String(c.settings.blackoutDates || '').split(/\s+/);
    for (
      let d = Math.floor(w.start / 86400000) * 86400000;
      d < w.end;
      d += 86400000
    )
      if (dates.includes(new Date(d).toISOString().slice(0, 10)))
        throw Error('This date is blocked out.');
  }
  return w;
}
function calendarGuard(
  c: Context,
  w: ReturnType<typeof appointmentWindow>,
  id = '',
) {
  return scheduleGuard(c.bid, id, w, [c.staffId], {
    weekly: false,
    bookings:
      c.calendar.bookings === 'None'
        ? false
        : c.calendar.bookings === 'All bookings'
          ? 'all'
          : true,
    timeOff: c.calendar.blockouts !== 'None',
    buffer: c.calendar.buffer,
  });
}
export async function schedulingTimes(c: Context, day: string) {
  date(day, 'Appointment date');
  const times: string[] = [];
  const step = Math.min(30, c.calendar.minutes);
  const db = rawDb();
  const [appointments, off, bookings] = await db.batch([
    db
      .prepare(
        "SELECT data FROM sales_records WHERE business_id=? AND kind='appointment' AND archived=0 AND ed_text(data,'$.status')='Scheduled' AND (ed_text(data,'$.organizer')=? OR EXISTS(SELECT 1 FROM ed_each(ed_text(data,'$.staffIds')) WHERE value=?))",
      )
      .bind(c.bid, c.staffId, c.staffId),
    db
      .prepare(
        "SELECT data FROM sales_records WHERE business_id=? AND kind='time_off' AND archived=0 AND ed_text(data,'$.status')='Approved' AND ed_text(data,'$.staffId')=?",
      )
      .bind(c.bid, c.staffId),
    db
      .prepare(
        "SELECT e.date,e.time,e.items,o.data FROM events e LEFT JOIN event_operations o ON e.id=o.event_id AND e.business_id=o.business_id WHERE e.business_id=? AND e.status='confirmed' AND e.lifecycle='Active'",
      )
      .bind(c.bid),
  ]);
  const blocked = [
    ...appointments.results.map((r: any) => {
      const d = JSON.parse(r.data),
        w = appointmentWindow(d),
        gap = Math.max(c.calendar.buffer, d.buffer || 0) * 60000;
      return { start: w.start - gap, end: w.end + gap };
    }),
    ...(c.calendar.blockouts === 'None'
      ? []
      : off.results.map((r: any) => timeOffWindow(JSON.parse(r.data)))),
    ...(c.calendar.bookings === 'None'
      ? []
      : bookings.results
          .filter(
            (r: any) =>
              c.calendar.bookings === 'All bookings' ||
              JSON.parse(r.data || '{}').staffIds?.includes(c.staffId),
          )
          .map((r: any) => eventWindow({ ...r, items: JSON.parse(r.items) }))),
  ];
  for (let minute = 0; minute < 1440; minute += step) {
    const time =
      String(Math.floor(minute / 60)).padStart(2, '0') +
      ':' +
      String(minute % 60).padStart(2, '0');
    let w;
    try {
      w = checkWindow(c, day, time);
    } catch {
      continue;
    }
    if (!blocked.some((b) => windowsOverlap(w, b))) times.push(time);
  }
  return times;
}
export async function saveAppointment(
  bid: unknown,
  data: Record<string, any>,
  id = '',
  updatedAt = '',
) {
  const db = rawDb(),
    now = new Date().toISOString();
  let guard = { sql: 'FALSE', args: [] as unknown[] };
  const prior = id
    ? await db
        .prepare(
          "SELECT data FROM sales_records WHERE id=? AND business_id=? AND kind='appointment' AND archived=0",
        )
        .bind(id, bid)
        .first<{ data: string }>()
    : null;
  const old = prior ? JSON.parse(prior.data) : null;
  const sameReservation =
    old?.status === 'Scheduled' &&
    ['date', 'time', 'minutes', 'organizer', 'calendarId'].every(
      (k) => (old[k] || '') === (data[k] || ''),
    ) &&
    JSON.stringify([...(old.staffIds || [])].sort()) ===
      JSON.stringify([...(data.staffIds || [])].sort());
  if (data.status === 'Scheduled' && !sameReservation) {
    if (data.calendarId) {
      const c = await calendarContext(data.organizer, data.calendarId, bid);
      if (data.minutes !== c.calendar.minutes)
        throw Error('Appointment length must match its scheduling calendar.');
      const w = checkWindow(c, data.date, data.time, false);
      data.buffer = c.calendar.buffer;
      guard = calendarGuard(c, w, id);
      // Guard against concurrent changes to the calendar or host availability after validation.
      guard.sql += ` OR NOT EXISTS(SELECT 1 FROM resources WHERE id=? AND business_id=? AND ed_json(data)=ed_json(?) AND archived=0) OR NOT EXISTS(SELECT 1 FROM resources WHERE id=? AND business_id=? AND data=? AND archived=0) OR COALESCE((SELECT data FROM business_settings WHERE business_id=?),'{}')!=?`;
      guard.args.push(
        c.id,
        bid,
        c.record,
        c.staffId,
        bid,
        c.staffRecord,
        bid,
        c.settingsRecord,
      );
      data.details =
        data.location === 'In Person'
          ? c.calendar.inPersonDetails
          : data.location === 'Phone'
            ? `${c.calendar.phoneDirection}. ${c.calendar.phoneDetails}`
            : c.calendar.otherDetails;
      data.confirmationMessage = c.calendar.confirmation;
      if (data.staffIds?.length) {
        const extra = scheduleGuard(bid, id, w, data.staffIds, {
          buffer: c.calendar.buffer,
        });
        guard.sql += ' OR ' + extra.sql;
        guard.args.push(...extra.args);
      }
    } else
      guard = scheduleGuard(
        bid,
        id,
        appointmentWindow(data),
        [...new Set([data.organizer, ...(data.staffIds || [])])] as string[],
        { buffer: 0 },
      );
  }
  const result = id
    ? await db
        .prepare(
          `UPDATE sales_records SET data=?,updated_at=? WHERE id=? AND business_id=? AND kind='appointment' AND updated_at=? AND archived=0 AND NOT (${guard.sql})`,
        )
        .bind(JSON.stringify(data), now, id, bid, updatedAt, ...guard.args)
        .run()
    : await db
        .prepare(
          `INSERT INTO sales_records(id,business_id,kind,data,created_at,updated_at) SELECT ?,?,'appointment',?,?,? WHERE NOT (${guard.sql})`,
        )
        .bind(
          crypto.randomUUID(),
          bid,
          JSON.stringify(data),
          now,
          now,
          ...guard.args,
        )
        .run();
  if (!result.meta.changes) {
    const error = Error(
      'Appointment changed or the time is no longer available. Refresh and choose an available time.',
    );
    error.name = 'AppointmentConflict';
    throw error;
  }
}
export async function staffSchedulingAction(
  bid: unknown,
  body: Record<string, any>,
) {
  if (
    ![
      'save_staff_availability',
      'save_appointment_calendar',
      'archive_appointment_calendar',
      'reorder_appointment_calendars',
    ].includes(body.action)
  )
    return false;
  const staff = await schedulingStaff(bid, body.staffId),
    db = rawDb(),
    now = new Date().toISOString();
  if (body.action === 'save_staff_availability') {
    const week = checkedWeek(body.week);
    const r = await db
      .prepare(
        "UPDATE resources SET data=ed_set(data,'$.bookingAvailability',ed_json(?)),updated_at=? WHERE id=? AND business_id=? AND data=? AND archived=0",
      )
      .bind(
        JSON.stringify(week),
        now,
        staff.id,
        bid,
        JSON.stringify(staff.data),
      )
      .run();
    if (!r.meta.changes)
      throw Error('Staff details changed. Refresh and try again.');
  } else if (body.action === 'reorder_appointment_calendars') {
    const rows = (
      await db
        .prepare(
          "SELECT id FROM resources WHERE business_id=? AND kind='appointment_calendars' AND archived=0 AND ed_text(data,'$.staffId')=?",
        )
        .bind(bid, staff.id)
        .all<{ id: string }>()
    ).results;
    if (
      !Array.isArray(body.ids) ||
      body.ids.length !== rows.length ||
      new Set(body.ids).size !== rows.length ||
      body.ids.some((id: string) => !rows.some((r) => r.id === id))
    )
      throw Error('Calendar list changed. Refresh and try again.');
    if (rows.length)
      await db.batch(
        body.ids.map((id: string, i: number) =>
          db
            .prepare(
              "UPDATE resources SET data=ed_set(data,'$.order',to_jsonb(CAST(? AS integer))),updated_at=? WHERE id=? AND business_id=?",
            )
            .bind(i, now, id, bid),
        ),
      );
  } else {
    const old = body.id
      ? await db
          .prepare(
            "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='appointment_calendars' AND archived=0 AND ed_text(data,'$.staffId')=?",
          )
          .bind(text(body.id, 'Calendar ID', 100), bid, staff.id)
          .first<{ data: string }>()
      : null;
    if (body.id && !old) throw Error('Calendar unavailable.');
    if (body.action === 'archive_appointment_calendar') {
      if (!old) throw Error('Choose a calendar.');
      await db
        .prepare(
          'UPDATE resources SET archived=1,updated_at=? WHERE id=? AND business_id=?',
        )
        .bind(now, body.id, bid)
        .run();
    } else {
      const name = text(body.name, 'Calendar title', 120),
        calendar = checkedCalendar(body.config),
        d = {
          staffId: staff.id,
          config: JSON.stringify(calendar),
          order: old ? JSON.parse(old.data).order || 0 : Date.now(),
        };
      if (old) {
        const r = await db
          .prepare(
            'UPDATE resources SET name=?,data=?,updated_at=? WHERE id=? AND business_id=? AND data=? AND archived=0',
          )
          .bind(name, JSON.stringify(d), now, body.id, bid, old.data)
          .run();
        if (!r.meta.changes)
          throw Error('Calendar changed. Refresh and try again.');
      } else
        await db
          .prepare(
            "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,'appointment_calendars',?,?,?,?)",
          )
          .bind(crypto.randomUUID(), bid, name, JSON.stringify(d), now, now)
          .run();
    }
  }
  return true;
}
export async function schedulingPage(staffId: string) {
  const s = await rawDb()
    .prepare(
      "SELECT r.id,r.name,r.business_id,b.name AS business FROM resources r JOIN businesses b ON b.id=r.business_id WHERE r.id=? AND r.kind='staff' AND r.archived=0 AND COALESCE(ed_number(r.data,'$.staffRole'),1)=1",
    )
    .bind(staffId)
    .first<any>();
  if (!s) return null;
  const rows = (
    await rawDb()
      .prepare(
        "SELECT id,name,data FROM resources WHERE business_id=? AND kind='appointment_calendars' AND archived=0 AND ed_text(data,'$.staffId')=? ORDER BY CAST(ed_number(data,'$.order') AS INTEGER)",
      )
      .bind(s.business_id, staffId)
      .all<any>()
  ).results;
  const calendars = rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      config: checkedCalendar(JSON.parse(r.data).config),
    }))
    .filter((r) => r.config.enabled)
    .map((r) => ({
      id: r.id,
      name: r.name,
      minutes: r.config.minutes,
      phoneRequired:
        r.config.phone && r.config.phoneDirection === 'I will call the invitee',
      invitation: r.config.invitation,
      questions: r.config.questions,
      locations: [
        ...(r.config.inPerson
          ? [{ value: 'In Person', label: 'In Person' }]
          : []),
        ...(r.config.phone ? [{ value: 'Phone', label: 'Phone' }] : []),
        ...(r.config.other
          ? [{ value: 'Other', label: r.config.otherLabel }]
          : []),
      ],
    }));
  const settings = (await configuration(s.business_id)).settings;
  return {
    staffId: s.id as string,
    staffName: s.name as string,
    business: s.business as string,
    timezone: String(settings.timezone || 'America/Los_Angeles'),
    calendars,
  };
}
