'use client';
import { useEffect, useState } from 'react';
import type { schedulingPage } from '@/db/appointment-scheduling';
import { SField, SChoice, SToggle } from '../../sales-ui';
type PageData = NonNullable<Awaited<ReturnType<typeof schedulingPage>>>;
export default function AppointmentScheduler({
  data,
  selected,
}: {
  data: PageData;
  selected: string;
}) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [calendar, setCalendar] = useState(
      selected || data.calendars[0]?.id || '',
    ),
    [day, setDay] = useState(today),
    [month, setMonth] = useState(today.slice(0, 7)),
    [times, setTimes] = useState<string[]>([]),
    [time, setTime] = useState(''),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [ack, setAck] = useState(false),
    [honey, setHoney] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const c = data.calendars.find((x) => x.id === calendar);
  useEffect(() => {
    if (!c) return;
    const controller = new AbortController();
    setLoading(true);
    setTimes([]);
    setError('');
    fetch(
      '/api/appointments?' +
        new URLSearchParams({ staff: data.staffId, calendar: c.id, date: day }),
      { signal: controller.signal },
    )
      .then(async (r) => {
        const j = (await r.json()) as { error?: string; times: string[] };
        if (!r.ok) throw Error(j.error);
        setTimes(j.times);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [calendar, day, data.staffId]);
  const first = new Date(month + '-01T12:00:00Z'),
    count = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate(),
    offset = first.getUTCDay();
  function shift(n: number) {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  }
  function selectDay(v: string) {
    setDay(v);
    setMonth(v.slice(0, 7));
    setTime('');
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff: data.staffId,
            calendar,
            date: day,
            time,
            answers,
            acknowledged: ack,
            companyWebsite: honey,
          }),
        }),
        j = (await r.json()) as { error?: string; message: string };
      if (!r.ok) throw Error(j.error);
      setMessage(j.message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to request appointment.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="schedule-page">
      <p>{data.business}</p>
      <h1>Schedule Appointment</h1>
      <p>Meet with {data.staffName}</p>
      {!c ? (
        <p>
          This scheduling calendar is unavailable. Contact the business for
          help.
        </p>
      ) : message ? (
        <section className="staff-box" role="status">
          <h2>Request received</h2>
          <p>{message}</p>
          <p>
            {c.name} · {day} at {time} · {data.timezone}
          </p>
          <p>
            The business will review your request. No confirmation message has
            been sent automatically.
          </p>
        </section>
      ) : (
        <div className="schedule-layout">
          <aside className="staff-box">
            <h2>{c.name}</h2>
            <p>{c.minutes} minutes</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{c.invitation}</p>
            <p>
              Timezone: <b>{data.timezone}</b>
            </p>
            <p>Appointments require approval.</p>
            {data.calendars.length > 1 && (
              <SChoice
                label="Scheduling calendar"
                value={calendar}
                options={data.calendars.map((x) => ({
                  value: x.id,
                  label: x.name,
                }))}
                onChange={(id) => {
                  setCalendar(id);
                  setTime('');
                  setAnswers({});
                }}
              />
            )}
          </aside>
          <section className="staff-box form-stack">
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {!time ? (
              <>
                <div className="panel-heading">
                  <button
                    className="secondary"
                    aria-label="Previous month"
                    disabled={month <= today.slice(0, 7)}
                    onClick={() => shift(-1)}
                  >
                    ←
                  </button>
                  <h2>
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(first)}
                  </h2>
                  <button
                    className="secondary"
                    aria-label="Next month"
                    onClick={() => shift(1)}
                  >
                    →
                  </button>
                </div>
                <div className="schedule-date-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                    (s) => (
                      <span key={s}>{s}</span>
                    ),
                  )}
                  {Array.from({ length: offset }, (_, i) => (
                    <span key={'empty' + i} />
                  ))}
                  {Array.from({ length: count }, (_, i) => {
                    const d = month + '-' + String(i + 1).padStart(2, '0');
                    return (
                      <button
                        key={d}
                        disabled={d < today}
                        aria-label={'Choose ' + d}
                        aria-pressed={day === d}
                        onClick={() => selectDay(d)}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <SField
                  label="Appointment date"
                  type="date"
                  value={day}
                  onChange={(d) => {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) selectDay(d);
                  }}
                />
                <h3>Available times · {day}</h3>
                {loading ? (
                  <p role="status">Checking availability…</p>
                ) : times.length ? (
                  <div className="schedule-times">
                    {times.map((t) => (
                      <button
                        className="secondary"
                        key={t}
                        onClick={() => {
                          setTime(t);
                          setAnswers((a) => ({
                            ...a,
                            location:
                              c.locations.length === 1
                                ? c.locations[0].value
                                : a.location || '',
                          }));
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>
                    No appointments are available on this date. Choose another
                    date.
                  </p>
                )}
              </>
            ) : (
              <form className="form-stack" onSubmit={submit}>
                <button
                  className="record-link"
                  type="button"
                  onClick={() => setTime('')}
                >
                  ← Choose another date or time
                </button>
                <h2>
                  {day} at {time}
                </h2>
                <p>
                  {c.minutes} minutes · {data.timezone}
                </p>
                {c.questions.map((q) => (
                  <div key={q.id}>
                    {q.id === 'location' || q.type === 'select' ? (
                      <label className="field">
                        <span>
                          {q.label}
                          {q.required ? ' *' : ''}
                        </span>
                        <select
                          aria-label={q.label}
                          required={q.required}
                          value={answers[q.id] || ''}
                          onChange={(e) =>
                            setAnswers({ ...answers, [q.id]: e.target.value })
                          }
                        >
                          <option value="">Choose…</option>
                          {(q.id === 'location'
                            ? c.locations
                            : q.options.map((v) => ({ value: v, label: v }))
                          ).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <SField
                        label={q.label}
                        required={
                          q.required ||
                          (q.id === 'phone' &&
                            c.phoneRequired &&
                            answers.location === 'Phone')
                        }
                        type={
                          q.id === 'email'
                            ? 'email'
                            : q.id === 'phone'
                              ? 'tel'
                              : q.type
                        }
                        value={answers[q.id] || ''}
                        onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                      />
                    )}{' '}
                    {q.hint && <small>{q.hint}</small>}
                  </div>
                ))}
                <div className="schedule-honey" aria-hidden="true">
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={honey}
                    onChange={(e) => setHoney(e.target.value)}
                    name="companyWebsite"
                  />
                </div>
                <SToggle
                  label="I understand this is a request and the time is not reserved until approved."
                  value={ack}
                  onChange={setAck}
                />
                <p className="muted">
                  Your contact information and answers will be shared with{' '}
                  {data.business} to review this request.
                </p>
                <button className="primary" disabled={busy || !ack}>
                  {busy ? 'Submitting…' : 'Request appointment'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
