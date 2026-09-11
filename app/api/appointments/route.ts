import {
  calendarContext,
  schedulingTimes,
  saveAppointment,
} from '@/db/appointment-scheduling';
import { checkedIntake } from '@/lib/staff-scheduling';
import { text, date } from '@/lib/crm';
import { limit } from '../booking/route';
export const dynamic = 'force-dynamic';
const reply = (d: unknown, status = 200) =>
  Response.json(d, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
function failure(e: unknown) {
  const m = e instanceof Error ? e.message : 'Scheduling unavailable.';
  return reply(
    {
      error:
        m === 'RATE_LIMIT'
          ? 'Too many requests. Please try again in 15 minutes.'
          : /D1_|SQLITE|Database unavailable/.test(m)
            ? 'Scheduling is temporarily unavailable. Please try again.'
            : m,
    },
    m === 'RATE_LIMIT' ? 429 : 400,
  );
}
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams,
      c = await calendarContext(
        text(q.get('staff'), 'Staff', 100),
        text(q.get('calendar'), 'Calendar', 100),
      );
    await limit(req, c.bid, 'appointment-availability');
    return reply({
      times: await schedulingTimes(c, date(q.get('date'), 'Appointment date')),
      timezone: c.zone,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    if (
      req.headers.get('sec-fetch-site') === 'cross-site' ||
      (req.headers.get('origin') &&
        req.headers.get('origin') !== new URL(req.url).origin)
    )
      return reply({ error: 'Invalid origin.' }, 403);
    const raw = await req.text();
    if (raw.length > 24000) return reply({ error: 'Form is too large.' }, 413);
    const b = JSON.parse(raw);
    if (b.companyWebsite || b.acknowledged !== true)
      throw Error(
        'Confirm that you understand this is an appointment request.',
      );
    const c = await calendarContext(
      text(b.staff, 'Staff', 100),
      text(b.calendar, 'Calendar', 100),
    );
    await limit(req, c.bid, 'submit');
    const day = date(b.date, 'Appointment date'),
      time = text(b.time, 'Appointment time', 5);
    if (!(await schedulingTimes(c, day)).includes(time))
      throw Error('That time is no longer available. Choose another time.');
    const answers = checkedIntake(c.calendar, b.answers);
    await saveAppointment(c.bid, {
      title: c.name,
      name: answers.name,
      email: answers.email,
      phone: answers.phone || '',
      additional: answers.additional || '',
      date: day,
      time,
      minutes: c.calendar.minutes,
      location: answers.location,
      details: '',
      notes: '',
      staffIds: [],
      organizer: c.staffId,
      eventId: '',
      status: 'Pending',
      calendarId: c.id,
      buffer: c.calendar.buffer,
      answers,
      questionLabels: Object.fromEntries(
        c.calendar.questions.map((q) => [q.id, q.label]),
      ),
    });
    return reply({
      message:
        'Your appointment request has been received and is awaiting approval. This time has not been reserved.',
    });
  } catch (e) {
    return failure(e);
  }
}
