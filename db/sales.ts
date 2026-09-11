import type { PreparedStatement } from '@/db/raw';
import { reportNames } from '@/lib/sales-reports';
import { rawDb } from './raw';
import { timeOffWindow } from '@/lib/staff-scheduling';
import { text, date, email, cents } from '@/lib/crm';
import { type SalesKind } from '@/lib/sales';
const optional = (v: unknown, label: string, max = 200) =>
  text(v ?? '', label, max, false);
const clock = (v: unknown) => {
  const s = text(v, 'Start time', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw Error('Enter a valid time.');
  return s;
};
function choice(v: unknown, options: string[], fallback: string) {
  const s = v ?? fallback;
  if (typeof s !== 'string' || !options.includes(s))
    throw Error('Choose a valid option.');
  return s;
}
function whole(v: unknown, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw Error(`Enter a whole number from ${min} to ${max}.`);
  return v;
}
function flag(v: unknown, fallback = false) {
  if (v === undefined) return fallback;
  if (typeof v !== 'boolean') throw Error('Invalid checkbox value.');
  return v;
}
export async function ownedEvent(bid: unknown, id: unknown, active = false) {
  const e = await rawDb()
    .prepare('SELECT * FROM events WHERE id=? AND business_id=?')
    .bind(text(id, 'Event ID', 100), bid)
    .first<Record<string, any>>();
  if (!e || (active && e.lifecycle !== 'Active'))
    throw Error('Event unavailable.');
  return e;
}
export async function staffId(bid: unknown, id: unknown, me = false) {
  const s = optional(id, 'Staff', 100);
  if (!s || (me && s === 'owner')) return s;
  if (
    !(await rawDb()
      .prepare(
        "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='staff' AND archived=0",
      )
      .bind(s, bid)
      .first())
  )
    throw Error('Staff unavailable.');
  return s;
}
async function eventId(bid: unknown, id: unknown) {
  const s = optional(id, 'Event', 100);
  if (s) await ownedEvent(bid, s);
  return s;
}
async function staffIds(bid: unknown, value: unknown) {
  if (!Array.isArray(value) || value.length > 30)
    throw Error('Choose up to 30 staff.');
  const ids = [];
  for (const id of [...new Set(value)]) ids.push(await staffId(bid, id));
  return ids.filter(Boolean);
}
export async function validatedSales(
  bid: unknown,
  kind: SalesKind,
  input: unknown,
) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('Invalid form.');
  const d = input as Record<string, any>;
  if (kind === 'appointment')
    return {
      title: text(d.title, 'Appointment title', 150),
      name: text(d.name, 'Attendee name', 120),
      email: email(d.email),
      phone: optional(d.phone, 'Phone', 40),
      additional: optional(d.additional, 'Additional attendees', 1000)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map(email)
        .join(', '),
      date: date(d.date, 'Scheduled date'),
      time: clock(d.time),
      minutes: whole(d.minutes, 15, 720),
      location: choice(
        d.location,
        ['In Person', 'Phone', 'Video call', 'Other'],
        'In Person',
      ),
      details: optional(d.details, 'Location details', 5000),
      notes: optional(d.notes, 'Private notes', 5000),
      staffIds: await staffIds(bid, d.staffIds || []),
      organizer: (await staffId(bid, d.organizer, true)) || 'owner',
      eventId: await eventId(bid, d.eventId),
      status: choice(d.status, ['Pending', 'Scheduled', 'Canceled', 'Declined'], 'Scheduled'),
      calendarId: optional(d.calendarId, 'Calendar ID', 100),
      answers: d.answers && typeof d.answers === 'object' && !Array.isArray(d.answers)
        ? Object.fromEntries(Object.entries(d.answers).slice(0,40).map(([k,v])=>[text(k,'Question',100),optional(v,'Answer',4000)])) : {},
      buffer: whole(d.buffer ?? 0, 0, 120),
      questionLabels: d.questionLabels && typeof d.questionLabels === 'object' && !Array.isArray(d.questionLabels)
        ? Object.fromEntries(Object.entries(d.questionLabels).slice(0,40).map(([k,v])=>[text(k,'Question',100),optional(v,'Question label',200)])) : {},
      confirmationMessage: optional(d.confirmationMessage,'Confirmation message',4000),
    };
  if (kind === 'task')
    return {
      title: text(d.title, 'Task title', 250),
      notes: optional(d.notes, 'Notes', 5000),
      due: date(d.due ?? '', 'Due date', false),
      assignee: await staffId(bid, d.assignee, true),
      eventId: await eventId(bid, d.eventId),
      done: flag(d.done),
    };
  if (kind === 'message') {
    const state = choice(
      d.state,
      [
        'Draft',
        'Awaiting Review',
        'Reviewed',
        'Scheduled draft',
        'Recorded incoming',
        'Recorded outgoing',
      ],
      'Draft',
    );
    const scheduledDate = date(d.scheduledDate ?? '', 'Planned date', false),
      scheduledTime = d.scheduledTime ? clock(d.scheduledTime) : '';
    if (state === 'Scheduled draft' && (!scheduledDate || !scheduledTime))
      throw Error('Set a planned date and time.');
    const attachments = Array.isArray(d.attachments)
      ? [...new Set(d.attachments)]
      : [];
    if (attachments.length > 20) throw Error('Choose up to 20 attachments.');
    for (const id of attachments)
      if (
        !(await rawDb()
          .prepare(
            "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='media' AND archived=0",
          )
          .bind(text(id, 'Attachment'), bid)
          .first())
      )
        throw Error('Attachment unavailable.');
    return {
      attachments,
      templateId: optional(d.templateId, 'Template ID', 100),
      eventId: await eventId(bid, d.eventId),
      channel: choice(d.channel, ['Email', 'SMS'], 'Email'),
      recipient:
        d.channel === 'SMS'
          ? text(d.recipient, 'Phone', 50)
          : email(d.recipient),
      subject: optional(d.subject, 'Subject', 250),
      body: text(d.body, 'Message', 10000),
      state,
      scheduledDate,
      scheduledTime,
      notes: optional(d.notes, 'Internal notes', 2000),
    };
  }
  if (kind === 'time_off') {
    const start = date(d.start, 'First day'),
      end = date(d.end, 'Last day');
    if (end < start) throw Error('Last day must follow the first day.');
    const staff = await staffId(bid, d.staffId);
    if (!staff) throw Error('Choose staff.');
    const allDay = flag(d.allDay, true), startTime = allDay ? '00:00' : clock(d.startTime), endTime = allDay ? '00:00' : clock(d.endTime);
    const w = timeOffWindow({ start, end, allDay, startTime, endTime });
    if(w.end <= w.start) throw Error('Time off must end after it starts.');
    return {
      staffId: staff,
      allDay, startTime, endTime,
      start,
      end,
      status: choice(d.status, ['Pending', 'Approved', 'Declined'], 'Approved'),
      notes: optional(d.notes, 'Notes', 2000),
    };
  }
  if (kind === 'expense_category')
    return { name: text(d.name, 'Category name', 100) };
  if (kind === 'expense_rule') {
    const repeat = choice(
        d.repeat,
        ['Each Booking', 'Monthly', 'Yearly'],
        'Each Booking',
      ),
      start = date(d.start, 'First date'),
      end = date(d.end ?? '', 'Last date', false);
    if (!cents(d.amount, 'Amount'))
      throw Error('Expense must be greater than zero.');
    if (d.payeeMode === 'Each assigned staff' && repeat !== 'Each Booking')
      throw Error('Staff expenses must repeat for each booking.');
    if (d.payeeMode !== 'Each assigned staff') text(d.payee, 'Payee', 150);
    if (end && end < start) throw Error('Last date must follow first date.');
    if (!Array.isArray(d.packageIds) || d.packageIds.length > 100)
      throw Error('Choose up to 100 packages.');
    for (const id of d.packageIds)
      if (
        !(await rawDb()
          .prepare('SELECT id FROM packages WHERE id=? AND business_id=?')
          .bind(text(id, 'Package ID'), bid)
          .first())
      )
        throw Error('Package unavailable.');
    return {
      name: text(d.name, 'Rule name', 150),
      repeat,
      start,
      end,
      dateBasis: choice(
        d.dateBasis,
        ['Event date', 'Confirmation date'],
        'Event date',
      ),
      payeeMode: choice(
        d.payeeMode,
        ['Custom', 'Each assigned staff'],
        'Custom',
      ),
      payee: optional(d.payee, 'Payee', 150),
      amount: cents(d.amount, 'Amount'),
      category: optional(d.category, 'Category', 100) || 'Other',
      reference: text(d.reference, 'Reference', 200),
      notes: optional(d.notes, 'Description', 5000),
      packageIds: [...new Set(d.packageIds)],
    };
  }
  if (kind === 'saved_report') {
    if (!reportNames.includes(d.report))
      throw Error('Choose an available report.');
    if (d.from && d.to && d.from > d.to)
      throw Error('Last date must follow first date.');
    return {
      name: text(d.name, 'Report name', 120),
      report: text(d.report, 'Report', 100),
      from: date(d.from ?? '', 'First date', false),
      to: date(d.to ?? '', 'Last date', false),
      group: optional(d.group, 'Group', 100),
      status: optional(d.status, 'Status', 100),
      search: optional(d.search, 'Search', 200),
    };
  }
  throw Error('Unsupported record type.');
}
export async function validatedExpense(bid: unknown, d: Record<string, any>) {
  const mode = choice(d.payeeMode, ['Custom', 'Staff'], 'Custom'),
    staff = await staffId(bid, d.staffId);
  if (mode === 'Staff' && !staff) throw Error('Choose a staff payee.');
  const name = text(d.payee, 'Payee', 120),
    amount = cents(d.amount, 'Expense');
  if (!amount) throw Error('Expense must be greater than zero.');
  return {
    name,
    data: {
      amount: amount / 100,
      date: date(d.date, 'Expense date'),
      category: optional(d.category, 'Category', 100) || 'Other',
      notes: optional(d.notes, 'Description', 5000),
      payeeMode: mode,
      staffId: mode === 'Staff' ? staff : '',
      eventId: await eventId(bid, d.eventId),
      reference: text(d.reference, 'Reference', 200),
    },
  };
}
export async function materializeExpenses(
  bid: unknown,
  timezone = 'America/Los_Angeles',
) {
  const db = rawDb(),
    now = new Date().toISOString(),
    today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
      new Date(),
    );
  const rules = (
    await db
      .prepare(
        "SELECT id,data FROM sales_records WHERE business_id=? AND kind='expense_rule' AND archived=0",
      )
      .bind(bid)
      .all<{ id: string; data: string }>()
  ).results;
  if (!rules.length) return;
  const events = (
    await db
      .prepare(
        "SELECT e.id,e.date,e.items,e.updated_at,o.data AS ops FROM events e LEFT JOIN event_operations o ON o.event_id=e.id AND o.business_id=e.business_id WHERE e.business_id=? AND e.status='confirmed' AND e.lifecycle='Active'",
      )
      .bind(bid)
      .all<Record<string, any>>()
  ).results;
  const existing = new Set(
    (
      await db
        .prepare(
          "SELECT id FROM resources WHERE business_id=? AND kind='expenses'",
        )
        .bind(bid)
        .all<{ id: string }>()
    ).results.map((x) => x.id),
  );
  const staff = (
    await db
      .prepare(
        "SELECT id,name FROM resources WHERE business_id=? AND kind='staff' AND archived=0",
      )
      .bind(bid)
      .all<{ id: string; name: string }>()
  ).results;
  const writes: PreparedStatement[] = [];
  const add = (
    id: string,
    r: Record<string, any>,
    day: string,
    event = '',
    person?: { id: string; name: string },
  ) => {
    if (
      writes.length >= 200 ||
      existing.has(id) ||
      day > today ||
      day < r.start ||
      (r.end && day > r.end)
    )
      return;
    existing.add(id);
    const data = {
      amount: r.amount / 100,
      date: day,
      category: r.category,
      notes: r.notes,
      eventId: event,
      reference: r.reference,
      payeeMode: person ? 'Staff' : 'Custom',
      staffId: person?.id || '',
      ruleId: r.id,
    };
    writes.push(
      db
        .prepare(
          "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,'expenses',?,?,?,?) ON CONFLICT(id) DO NOTHING",
        )
        .bind(
          id,
          bid,
          person?.name || r.payee || r.name,
          JSON.stringify(data),
          now,
          now,
        ),
    );
  };
  for (const row of rules) {
    const r = { ...JSON.parse(row.data), id: row.id };
    if (r.repeat === 'Each Booking') {
      for (const e of events) {
        if (
          r.packageIds.length &&
          !JSON.parse(e.items).some((p: { id: string }) =>
            r.packageIds.includes(p.id),
          )
        )
          continue;
        const day =
          r.dateBasis === 'Event date'
            ? e.date
            : (
                JSON.parse(e.ops || '{}').sales?.confirmedAt || e.updated_at
              ).slice(0, 10);
        if (r.payeeMode === 'Each assigned staff') {
          for (const s of staff.filter((s) =>
            JSON.parse(e.ops || '{}').staffIds?.includes(s.id),
          ))
            add(row.id + ':' + e.id + ':' + s.id, r, day, e.id, s);
        } else add(row.id + ':' + e.id, r, day, e.id);
      }
    } else {
      const start = new Date(r.start + 'T12:00:00Z'),
        todayYear = Number(today.slice(0, 4));
      for (let i = 0; i < 1200; i++) {
        const month =
            start.getUTCMonth() + (r.repeat === 'Yearly' ? 12 * i : i),
          target = new Date(Date.UTC(start.getUTCFullYear(), month, 1, 12));
        if (target.getUTCFullYear() > todayYear) break;
        const last = new Date(
          Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
        ).getUTCDate();
        target.setUTCDate(Math.min(start.getUTCDate(), last));
        const day = target.toISOString().slice(0, 10);
        if (day > today) break;
        add(row.id + ':' + day, r, day);
      }
    }
  }
  if (writes.length) await db.batch(writes);
}
