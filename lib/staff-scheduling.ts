import { text, email } from './crm';
export const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export type DayHours = {
  mode: 'all' | 'hours' | 'off';
  start: string;
  end: string;
};
export const defaultWeek = (): DayHours[] =>
  days.map(() => ({ mode: 'all', start: '09:00', end: '17:00' }));
export function checkedTime(v: unknown) {
  const s = String(v ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw Error('Enter a valid time.');
  return s;
}
export function checkedWeek(v: unknown): DayHours[] {
  const a = typeof v === 'string' ? JSON.parse(v) : v;
  if (!Array.isArray(a) || a.length !== 7)
    throw Error('Set availability for all seven days.');
  return a.map((d) => {
    if (!d || !['all', 'hours', 'off'].includes(d.mode))
      throw Error('Choose valid weekly availability.');
    const start = checkedTime(d.start),
      end = checkedTime(d.end);
    if (d.mode === 'hours' && end <= start)
      throw Error(
        'Latest end must be after earliest start. Split overnight hours across two days.',
      );
    return { mode: d.mode, start, end };
  });
}
export const weekFor = (v: unknown): DayHours[] =>
  v ? checkedWeek(v) : defaultWeek();
export type Window = { start: number; end: number };
export const wall = (day: string, time = '00:00') =>
  Date.parse(day + 'T' + time + ':00Z');
export const appointmentWindow = (d: Record<string, any>): Window => ({
  start: wall(d.date, d.time),
  end: wall(d.date, d.time) + Number(d.minutes) * 60000,
});
export const timeOffWindow = (d: Record<string, any>): Window => ({
  start: wall(d.start, d.allDay === false ? d.startTime : '00:00'),
  end:
    wall(d.end, d.allDay === false ? d.endTime : '00:00') +
    (d.allDay === false ? 0 : 86400000),
});
export function segments(w: Window) {
  const result: { day: number; start: string; end: string }[] = [];
  for (let t = w.start; t < w.end;) {
    const d = new Date(t),
      mid =
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) +
        86400000,
      next = Math.min(mid, w.end);
    result.push({
      day: d.getUTCDay(),
      start: d.toISOString().slice(11, 16),
      end: next === mid ? '24:00' : new Date(next).toISOString().slice(11, 16),
    });
    t = next;
    if (result.length > 370) throw Error('Schedule is too long.');
  }
  return result;
}
export function weeklyAllows(week: DayHours[], w: Window) {
  return segments(w).every((s) => {
    const d = week[s.day];
    return (
      d.mode === 'all' ||
      (d.mode === 'hours' && d.start <= s.start && d.end >= s.end)
    );
  });
}
export type AppointmentQuestion = {
  id: string;
  label: string;
  hint: string;
  type: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'select';
  required: boolean;
  options: string[];
};
export const coreQuestions = () =>
  [
    {
      id: 'location',
      label: 'Appointment Location',
      type: 'select',
      required: true,
    },
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'email', label: 'Email', type: 'text', required: true },
    { id: 'phone', label: 'Phone', type: 'text', required: false },
    {
      id: 'additional',
      label: 'Guest Email(s)',
      type: 'text',
      required: false,
    },
    {
      id: 'notes',
      label: 'Additional Notes',
      type: 'textarea',
      required: false,
    },
  ].map(
    (q) =>
      ({
        ...q,
        hint:
          q.id === 'additional'
            ? 'Up to five email addresses, separated by commas.'
            : '',
        options: [],
      }) as AppointmentQuestion,
  );
export const questionSamples = [
  'Event Date',
  'Event Time',
  'Event Length',
  'Venue Name',
  'Venue Address',
  'Customer Address',
  'Business Name',
  'Event Type',
  'Estimated Guest Count',
  'Lead Source',
  'Setup At',
  'Dropoff At',
  'Stair Setup',
  'PO Number',
  'Setup Location',
  'Pickup At',
  'Contact Preferences',
  'Estimated Budget',
];
export type AppointmentCalendar = {
  enabled: boolean;
  minutes: number;
  buffer: number;
  notice: number;
  maxDays: number | null;
  bookings: 'None' | 'Assigned bookings only' | 'All bookings';
  blockouts: 'None' | 'Staff time off only' | 'All blockout dates';
  sameWeek: boolean;
  week: DayHours[];
  inPerson: boolean;
  inPersonDetails: string;
  phone: boolean;
  phoneDirection: 'I will call the invitee' | 'The invitee will call me';
  phoneDetails: string;
  other: boolean;
  otherLabel: string;
  otherDetails: string;
  invitation: string;
  confirmation: string;
  questions: AppointmentQuestion[];
};
export const defaultCalendar = (): AppointmentCalendar => ({
  enabled: true,
  minutes: 30,
  buffer: 0,
  notice: 0,
  maxDays: null,
  bookings: 'Assigned bookings only',
  blockouts: 'All blockout dates',
  sameWeek: true,
  week: defaultWeek(),
  inPerson: false,
  inPersonDetails: '',
  phone: true,
  phoneDirection: 'I will call the invitee',
  phoneDetails: '',
  other: false,
  otherLabel: 'Video meeting',
  otherDetails: '',
  invitation: 'Choose an available time to request a meeting.',
  confirmation: 'Your appointment has been approved.',
  questions: coreQuestions(),
});
export function checkedCalendar(input: unknown): AppointmentCalendar {
  const d = typeof input === 'string' ? JSON.parse(input) : input;
  if (!d || typeof d !== 'object' || Array.isArray(d))
    throw Error('Invalid scheduling settings.');
  const defaults = defaultCalendar();
  const c = Object.fromEntries(
    Object.keys(defaults).map((k) => [
      k,
      d[k] ?? defaults[k as keyof AppointmentCalendar],
    ]),
  ) as AppointmentCalendar;
  for (const k of [
    'enabled',
    'sameWeek',
    'inPerson',
    'phone',
    'other',
  ] as const)
    if (typeof c[k] !== 'boolean') throw Error('Invalid scheduling choice.');
  for (const [k, max] of [
    ['minutes', 720],
    ['buffer', 120],
    ['notice', 10080],
  ] as const)
    if (
      !Number.isInteger(c[k]) ||
      c[k] < (k === 'minutes' ? 15 : 0) ||
      c[k] > max
    )
      throw Error('Invalid appointment duration, buffer or notice.');
  if (
    c.maxDays !== null &&
    (!Number.isInteger(c.maxDays) || c.maxDays < 1 || c.maxDays > 3650)
  )
    throw Error('Maximum days must be blank or between 1 and 3650.');
  if (
    !['None', 'Assigned bookings only', 'All bookings'].includes(c.bookings) ||
    !['None', 'Staff time off only', 'All blockout dates'].includes(
      c.blockouts,
    ) ||
    !['I will call the invitee', 'The invitee will call me'].includes(
      c.phoneDirection,
    )
  )
    throw Error('Choose a valid conflict or meeting option.');
  if (!c.inPerson && !c.phone && !c.other)
    throw Error('Enable at least one meeting location.');
  const clean = { ...c, week: checkedWeek(c.week) } as AppointmentCalendar;
  for (const k of [
    'inPersonDetails',
    'phoneDetails',
    'otherDetails',
    'invitation',
    'confirmation',
  ] as const)
    clean[k] = text(c[k], k, 4000, false);
  clean.otherLabel = text(c.otherLabel, 'Meeting label', 120, c.other);
  if (!Array.isArray(c.questions) || c.questions.length > 40)
    throw Error('Choose up to 40 intake questions.');
  clean.questions = c.questions.map((q: AppointmentQuestion) => {
    if (
      !q ||
      !['text', 'textarea', 'date', 'time', 'number', 'select'].includes(
        q.type,
      ) ||
      typeof q.required !== 'boolean'
    )
      throw Error('Invalid intake question.');
    if (!Array.isArray(q.options) || q.options.length > 50)
      throw Error('Choose up to 50 answers.');
    return {
      id: text(q.id, 'Question ID', 100),
      label: text(q.label, 'Question label', 200),
      hint: text(q.hint, 'Question hint', 1000, false),
      type: q.type,
      required: q.required,
      options: q.options.map((o) => text(o, 'Answer option', 200)),
    };
  });
  if (new Set(clean.questions.map((q) => q.id)).size !== clean.questions.length)
    throw Error('Question IDs must be unique.');
  for (const id of ['location', 'name', 'email'])
    if (!clean.questions.some((q) => q.id === id && q.required))
      throw Error('Location, name and email are required.');
  if (
    clean.phone &&
    clean.phoneDirection === 'I will call the invitee' &&
    !clean.questions.some((q) => q.id === 'phone')
  )
    throw Error('Keep the Phone question when you will call the invitee.');
  return clean;
}
export function checkedIntake(c: AppointmentCalendar, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('Complete the appointment form.');
  const answers: Record<string, string> = {};
  for (const q of c.questions) {
    const s = text(
      (input as Record<string, unknown>)[q.id] ?? '',
      q.label,
      q.type === 'textarea' ? 4000 : 1000,
      q.required,
    );
    if (
      s &&
      q.type === 'date' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(wall(s)))
    )
      throw Error('Enter a valid date.');
    if (s && q.type === 'time') checkedTime(s);
    if (s && q.type === 'number' && !Number.isFinite(Number(s)))
      throw Error('Enter a valid number.');
    if (
      s &&
      q.type === 'select' &&
      q.id !== 'location' &&
      !q.options.includes(s)
    )
      throw Error('Choose a valid answer.');
    answers[q.id] = s;
  }
  answers.email = email(answers.email);
  if (answers.additional) {
    const a = answers.additional
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (a.length > 5) throw Error('Add no more than five guest emails.');
    answers.additional = a.map(email).join(', ');
  }
  const locations = [
    c.inPerson ? 'In Person' : '',
    c.phone ? 'Phone' : '',
    c.other ? 'Other' : '',
  ].filter(Boolean);
  if (!locations.includes(answers.location))
    throw Error('Choose an available meeting location.');
  if (
    answers.location === 'Phone' &&
    c.phoneDirection === 'I will call the invitee' &&
    !answers.phone
  )
    throw Error('Enter a phone number so the host can call you.');
  return answers;
}
// Dates in the CRM are business-local wall times. Resolve them to an instant only for notice checks.
export function zonedInstant(day: string, time: string, zone: string) {
  const target = wall(day, time);
  let instant = target;
  const parts = (t: number) => {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(t));
    const g = (s: string) => p.find((x) => x.type === s)!.value;
    return wall(
      `${g('year')}-${g('month')}-${g('day')}`,
      `${g('hour')}:${g('minute')}`,
    );
  };
  for (let i = 0; i < 4; i++) instant += target - parts(instant);
  return parts(instant) === target ? instant : NaN;
}
