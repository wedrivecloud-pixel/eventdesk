'use client';
import { useState } from 'react';
import type { Resource } from '@/lib/settings';
import {
  days,
  weekFor,
  defaultCalendar,
  checkedCalendar,
  questionSamples,
  type DayHours,
  type AppointmentCalendar,
  type AppointmentQuestion,
} from '@/lib/staff-scheduling';
import { salesRows, localToday } from '@/lib/sales';
import { ManagedResources, type ManageProps } from './manage-resources';
import { SField, SChoice, SToggle, STabs, STable, SActions } from './sales-ui';
import { CopyBlock } from './manage-hubs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import './staff-scheduling.css';
export function WeekEditor({
  value,
  onChange,
}: {
  value: DayHours[];
  onChange: (v: DayHours[]) => void;
}) {
  return (
    <div className="staff-week">
      {value.map((d, i) => (
        <div className="staff-week-row" key={i}>
          <SChoice
            label={days[i]}
            value={d.mode}
            options={[
              { value: 'all', label: 'Yes, all day' },
              { value: 'hours', label: 'Yes, certain hours' },
              { value: 'off', label: 'No' },
            ]}
            onChange={(mode) =>
              onChange(
                value.map((x, n) =>
                  n === i ? { ...x, mode: mode as DayHours['mode'] } : x,
                ),
              )
            }
          />
          {d.mode === 'hours' && (
            <>
              <SField
                label={`${days[i]} earliest start`}
                type="time"
                value={d.start}
                onChange={(start) =>
                  onChange(value.map((x, n) => (n === i ? { ...x, start } : x)))
                }
              />
              <SField
                label={`${days[i]} latest end`}
                type="time"
                value={d.end}
                onChange={(end) =>
                  onChange(value.map((x, n) => (n === i ? { ...x, end } : x)))
                }
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
function WeekSummary({ week }: { week: DayHours[] }) {
  return (
    <dl className="staff-summary">
      {week.map((d, i) => (
        <div key={i}>
          <dt>{days[i]}</dt>
          <dd>
            {d.mode === 'all'
              ? 'All day'
              : d.mode === 'off'
                ? 'Unavailable'
                : `${d.start} – ${d.end}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function StaffAccounts(p: ManageProps & { selectedStaffId?: string; initialTab?: string }) {
  const [selected, setSelected] = useState(p.selectedStaffId || ''),
    [tab, setTab] = useState(p.initialTab || 'Overview'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const staff = p.data.resources?.find(
    (r) => r.id === selected && r.kind === 'staff' && !r.archived,
  );
  async function run(body: Record<string, unknown>, endpoint = '/api/manage') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        j = (await r.json()) as import('@/lib/crm').Data & { error?: string };
      if (!r.ok) throw Error(j.error);
      p.onData(j);
      setNotice('Changes saved.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!staff)
    return (
      <ManagedResources
        {...p}
        kind="staff"
        onStaff={(r, t) => {
          setSelected(r.id);
          setTab(t);
          setError('');
          setNotice('');
        }}
      />
    );
  const calendars = (p.data.resources || [])
    .filter(
      (r) =>
        r.kind === 'appointment_calendars' &&
        !r.archived &&
        r.data.staffId === staff.id,
    )
    .sort((a, b) => Number(a.data.order || 0) - Number(b.data.order || 0));
  const link =
    (typeof window === 'undefined' ? '' : window.location.origin) +
    '/schedule/' +
    staff.id;
  return (
    <section className="panel settings-panel staff-profile">
      <div className="panel-heading">
        <div>
          <button className="record-link" onClick={() => setSelected('')}>
            ← All user accounts
          </button>
          <h2>{staff.name}</h2>
          <p className="muted">
            {String(staff.data.email || '')} ·{' '}
            {String(p.data.settings?.timezone || 'America/Los_Angeles')}
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => p.onNavigate('Appointments')}
        >
          View appointments
        </button>
      </div>
      <STabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setError('');
          setNotice('');
        }}
        tabs={[
          'Overview',
          'Staff Booking Availability',
          'Appointment Scheduling',
          'Schedule',
        ]}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {tab === 'Overview' && (
        <div className="staff-panels">
          <section className="staff-box">
            <h3>Basic Information</h3>
            <p>
              {String(
                staff.data.bio ||
                  staff.data.notes ||
                  'Add profile details using Edit user in the accounts list.',
              )}
            </p>
            <p>{String(staff.data.phone || '')}</p>
            <h4>Account Settings</h4>
            <p>
              {[
                staff.data.adminRole ? 'Admin' : '',
                staff.data.staffRole !== false ? 'Staff' : '',
                staff.data.customerRole ? 'Customer' : '',
              ]
                .filter(Boolean)
                .join(' · ') || 'User'}
            </p>
            <p className="muted">
              Account roles are staff records. Invitations and separate staff
              sign-in are not connected.
            </p>
          </section>
          <section className="staff-box">
            <h3>Staff Booking Availability</h3>
            <WeekSummary week={weekFor(staff.data.bookingAvailability)} />
            <button
              className="secondary"
              onClick={() => setTab('Staff Booking Availability')}
            >
              Edit booking availability
            </button>
          </section>
          <section className="staff-box">
            <h3>Appointment Scheduling</h3>
            <p>
              {calendars.length} scheduling calendar
              {calendars.length === 1 ? '' : 's'}
            </p>
            <button
              className="secondary"
              onClick={() => setTab('Appointment Scheduling')}
            >
              Manage scheduling calendars
            </button>
            {calendars.length > 0 && (
              <CopyBlock
                label="Share appointment scheduling link"
                value={link}
              />
            )}
          </section>
        </div>
      )}
      {tab === 'Staff Booking Availability' && (
        <BookingAvailability
          key={staff.id}
          staff={staff}
          p={p}
          busy={busy}
          error={error}
          run={run}
        />
      )}
      {tab === 'Appointment Scheduling' && (
        <Calendars
          key={staff.id}
          staff={staff}
          calendars={calendars}
          link={link}
          busy={busy}
          run={run}
        />
      )}
      {tab === 'Schedule' && (
        <>
          <h3>Assigned bookings & appointments</h3>
          <STable
            headers={['Title', 'Date', 'Time', 'Status']}
            rows={[
              ...p.data.events
                .filter(
                  (e) =>
                    e.operations?.staffIds?.includes(staff.id) &&
                    e.lifecycle === 'Active',
                )
                .map((e) => [e.title, e.date, e.time, e.status]),
              ...salesRows(p.data, 'appointment')
                .filter(
                  (r) =>
                    !r.archived &&
                    (r.data.organizer === staff.id ||
                      r.data.staffIds?.includes(staff.id)),
                )
                .map((r) => [
                  r.data.title,
                  r.data.date,
                  r.data.time,
                  r.data.status,
                ]),
            ]}
          />
          <button
            className="secondary"
            onClick={() => p.onNavigate('Calendar')}
          >
            Open sales calendar
          </button>
        </>
      )}
    </section>
  );
}
type Run = (
  body: Record<string, unknown>,
  endpoint?: string,
) => Promise<boolean>;
function BookingAvailability({
  staff,
  p,
  busy,
  error,
  run,
}: {
  staff: Resource;
  p: ManageProps;
  busy: boolean;
  error: string;
  run: Run;
}) {
  const [week, setWeek] = useState(() =>
      weekFor(staff.data.bookingAvailability),
    ),
    [past, setPast] = useState(false),
    [off, setOff] = useState<Record<string, any>>(),
    today = localToday(p.data);
  const rows = salesRows(p.data, 'time_off')
    .filter(
      (r) =>
        !r.archived &&
        r.data.staffId === staff.id &&
        (past || r.data.end >= today),
    )
    .sort((a, b) => a.data.start.localeCompare(b.data.start));
  return (
    <div className="form-stack">
      <section className="staff-box">
        <div className="panel-heading">
          <h3>Schedule Time Off</h3>
          <button
            className="secondary"
            onClick={() =>
              setOff({
                staffId: staff.id,
                start: today,
                end: today,
                allDay: true,
                startTime: '09:00',
                endTime: '17:00',
                status: 'Approved',
                notes: '',
              })
            }
          >
            Add time off
          </button>
        </div>
        <SToggle label="Show past time off" value={past} onChange={setPast} />
        <STable
          headers={['Start', 'End', 'Reason', 'Status', 'Actions']}
          rows={rows.map((r) => [
            r.data.start +
              (r.data.allDay === false ? ' ' + r.data.startTime : ' · All day'),
            r.data.end + (r.data.allDay === false ? ' ' + r.data.endTime : ''),
            r.data.notes,
            r.data.status,
            <SActions
              label={`Time off ${r.data.start}`}
              items={[
                {
                  label: 'Edit time off',
                  action: () =>
                    setOff({ ...r.data, id: r.id, updatedAt: r.updated_at }),
                },
                {
                  label: 'Remove time off',
                  action: () =>
                    run(
                      {
                        action: 'archive_record',
                        id: r.id,
                        updatedAt: r.updated_at,
                        archived: true,
                      },
                      '/api/sales',
                    ),
                },
              ]}
            />,
          ])}
        />
      </section>
      <form
        className="staff-box form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          await run({
            action: 'save_staff_availability',
            staffId: staff.id,
            week,
          });
        }}
      >
        <h3>Available Days of the Week</h3>
        <p className="muted">
          These hours apply to staff assignments on event bookings. For
          overnight availability, set hours on both days.
        </p>
        <WeekEditor value={week} onChange={setWeek} />
        <button className="primary" disabled={busy}>
          Save booking availability
        </button>
      </form>
      <Dialog
        open={!!off}
        onOpenChange={(v) => {
          if (!v) setOff(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {off?.id ? 'Edit time off' : 'Add time off'}
            </DialogTitle>
            <DialogDescription>
              Approved time off affects this staff member’s availability.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {off && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await run(
                    {
                      action: 'save_record',
                      kind: 'time_off',
                      id: off.id,
                      updatedAt: off.updatedAt,
                      data: off,
                    },
                    '/api/sales',
                  )
                )
                  setOff(undefined);
              }}
            >
              <div className="form-grid">
                <SField
                  label="Start date"
                  type="date"
                  required
                  value={off.start}
                  onChange={(start) => setOff({ ...off, start })}
                />
                <SField
                  label="End date"
                  type="date"
                  required
                  value={off.end}
                  onChange={(end) => setOff({ ...off, end })}
                />
              </div>
              <SToggle
                label="All day"
                value={off.allDay !== false}
                onChange={(allDay) => setOff({ ...off, allDay })}
              />
              {off.allDay === false && (
                <div className="form-grid">
                  <SField
                    label="Start time"
                    type="time"
                    required
                    value={off.startTime}
                    onChange={(startTime) => setOff({ ...off, startTime })}
                  />
                  <SField
                    label="End time"
                    type="time"
                    required
                    value={off.endTime}
                    onChange={(endTime) => setOff({ ...off, endTime })}
                  />
                </div>
              )}
              <SField
                label="Reason"
                type="textarea"
                value={off.notes}
                onChange={(notes) => setOff({ ...off, notes })}
              />
              <SChoice
                label="Approval"
                value={off.status}
                options={['Approved', 'Pending', 'Declined']}
                onChange={(status) => setOff({ ...off, status })}
              />
              <button className="primary" disabled={busy}>
                Save time off
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Calendars({
  staff,
  calendars,
  link,
  busy,
  run,
}: {
  staff: Resource;
  calendars: Resource[];
  link: string;
  busy: boolean;
  run: Run;
}) {
  const [editing, setEditing] = useState<{
      id?: string;
      name: string;
      config: AppointmentCalendar;
    }>(),
    [tab, setTab] = useState('Overview'),
    [deleting, setDeleting] = useState<Resource>();
  const open = (r: Resource, t = 'Overview') => {
    setEditing({
      id: r.id,
      name: r.name,
      config: checkedCalendar(r.data.config),
    });
    setTab(t);
  };
  if (editing)
    return (
      <CalendarEditor
        key={editing.id || 'new'}
        item={editing}
        initialTab={tab}
        staff={staff}
        link={link + (editing.id ? '?calendar=' + editing.id : '')}
        busy={busy}
        onClose={() => setEditing(undefined)}
        onSave={async (name, config) => {
          if (
            await run({
              action: 'save_appointment_calendar',
              staffId: staff.id,
              id: editing.id,
              name,
              config,
            })
          )
            setEditing(undefined);
        }}
      />
    );
  async function move(index: number, delta: number) {
    const ids = calendars.map((r) => r.id),
      other = index + delta;
    [ids[index], ids[other]] = [ids[other], ids[index]];
    await run({
      action: 'reorder_appointment_calendars',
      staffId: staff.id,
      ids,
    });
  }
  return (
    <div className="form-stack">
      <div className="panel-heading">
        <div>
          <h3>Appointment Scheduling</h3>
          <p className="muted">
            Offer separate calendars for consultations, planning meetings or
            venue tours.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing({ name: 'Default', config: defaultCalendar() });
            setTab('Scheduling');
          }}
        >
          New scheduling calendar
        </button>
      </div>
      {!calendars.length && (
        <p className="empty-state">
          Create a scheduling calendar to set appointment hours and get a
          shareable link.
        </p>
      )}
      {calendars.map((r, i) => {
        const c = checkedCalendar(r.data.config);
        return (
          <article className="staff-box" key={r.id}>
            <div className="panel-heading">
              <div>
                <h3>{r.name}</h3>
                <p>
                  {c.enabled ? 'Active' : 'Paused'} · {c.minutes} minutes ·{' '}
                  {c.buffer} minute buffer ·{' '}
                  {c.notice
                    ? `${c.notice} minute minimum notice`
                    : 'No minimum notice'}
                </p>
              </div>
              <SActions
                label={`Calendar actions: ${r.name}`}
                items={[
                  { label: 'Show details', action: () => open(r) },
                  {
                    label: 'Edit Scheduling',
                    action: () => open(r, 'Scheduling'),
                  },
                  {
                    label: 'Edit Meeting Details',
                    action: () => open(r, 'Meeting Details'),
                  },
                  {
                    label: 'Edit Questions',
                    action: () => open(r, 'Questions'),
                  },
                  {
                    label: 'Preview Calendar',
                    action: () =>
                      window.open(
                        link + '?calendar=' + r.id,
                        '_blank',
                        'noopener',
                      ),
                  },
                  {
                    label: 'Scheduling Link',
                    action: () => open(r, 'Scheduling Link'),
                  },
                  {
                    label: 'Duplicate',
                    action: () =>
                      run({
                        action: 'save_appointment_calendar',
                        staffId: staff.id,
                        name: r.name + ' (copy)',
                        config: c,
                      }),
                  },
                  {
                    label: c.enabled ? 'Pause scheduling' : 'Enable scheduling',
                    action: () =>
                      run({
                        action: 'save_appointment_calendar',
                        staffId: staff.id,
                        id: r.id,
                        name: r.name,
                        config: { ...c, enabled: !c.enabled },
                      }),
                  },
                  {
                    label: 'Move up',
                    disabled: i === 0,
                    action: () => move(i, -1),
                  },
                  {
                    label: 'Move down',
                    disabled: i === calendars.length - 1,
                    action: () => move(i, 1),
                  },
                  { label: 'Delete calendar', action: () => setDeleting(r) },
                ]}
              />
            </div>
            <p>
              Locations:{' '}
              {[
                c.inPerson ? 'In Person' : '',
                c.phone ? 'Phone' : '',
                c.other ? c.otherLabel : '',
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
            <p>
              {c.sameWeek
                ? 'Uses weekly booking availability'
                : 'Uses its own appointment hours'}
            </p>
            <button className="secondary" onClick={() => open(r)}>
              Show details
            </button>
          </article>
        );
      })}
      {calendars.length > 0 && (
        <CopyBlock
          label="Share staff appointment scheduling link"
          value={link}
        />
      )}
      <p className="capability-note">
        Client requests need your approval. The hosted site currently allows
        only its owner; external clients need site access before they can use
        these links.
      </p>
      <section className="staff-box">
        <h3>Meeting integrations</h3>
        <p>
          Zoom and Google Calendar / Google Meet are not connected. Add a
          meeting address or video link under Meeting Details. Automatic
          video-room creation, external calendar sync and message delivery are
          not enabled.
        </p>
      </section>
      <Dialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v) setDeleting(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete scheduling calendar?</DialogTitle>
            <DialogDescription>
              {deleting?.name} will stop accepting requests. Existing
              appointments and request history are kept.
            </DialogDescription>
          </DialogHeader>
          <button
            className="danger"
            disabled={busy}
            onClick={async () => {
              if (
                await run({
                  action: 'archive_appointment_calendar',
                  staffId: staff.id,
                  id: deleting?.id,
                })
              )
                setDeleting(undefined);
            }}
          >
            Delete calendar
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function CalendarEditor({
  item,
  initialTab,
  staff,
  link,
  busy,
  onClose,
  onSave,
}: {
  item: { id?: string; name: string; config: AppointmentCalendar };
  initialTab: string;
  staff: Resource;
  link: string;
  busy: boolean;
  onClose: () => void;
  onSave: (n: string, c: AppointmentCalendar) => Promise<void>;
}) {
  const [name, setName] = useState(item.name),
    [c, setC] = useState(item.config),
    [tab, setTab] = useState(initialTab);
  const set = <K extends keyof AppointmentCalendar>(
    k: K,
    v: AppointmentCalendar[K],
  ) => setC({ ...c, [k]: v });
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(name, c);
      }}
    >
      <button type="button" className="record-link" onClick={onClose}>
        ← Scheduling calendars
      </button>
      <h3>{name || 'New calendar'}</h3>
      <STabs
        value={tab}
        onChange={setTab}
        tabs={[
          'Overview',
          'Scheduling',
          'Meeting Details',
          'Questions',
          'Scheduling Link',
        ]}
      />
      {tab === 'Overview' && (
        <div className="staff-panels">
          <section className="staff-box">
            <h4>Scheduling</h4>
            <p>
              {c.minutes} minutes · {c.buffer} minute buffer
            </p>
            <p>Minimum notice: {c.notice} minutes</p>
            <p>Maximum days ahead: {c.maxDays ?? 'No limit'}</p>
            <p>Booking conflicts: {c.bookings}</p>
            <p>Blockouts: {c.blockouts}</p>
            <button
              type="button"
              className="secondary"
              onClick={() => setTab('Scheduling')}
            >
              Edit scheduling
            </button>
          </section>
          <section className="staff-box">
            <h4>Weekly Appointment Availability</h4>
            <WeekSummary
              week={
                c.sameWeek ? weekFor(staff.data.bookingAvailability) : c.week
              }
            />
          </section>
          <section className="staff-box">
            <h4>Meeting details</h4>
            <p>{c.invitation}</p>
            <button
              type="button"
              className="secondary"
              onClick={() => setTab('Meeting Details')}
            >
              Edit meeting details
            </button>
          </section>
        </div>
      )}
      {tab === 'Scheduling' && (
        <>
          <div className="form-grid">
            <SField label="Title" required value={name} onChange={setName} />
            <SChoice
              label="Appointment length"
              value={String(c.minutes)}
              options={[
                15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 420,
                480, 540, 600, 660, 720,
              ].map((n) => ({ value: String(n), label: `${n} minutes` }))}
              onChange={(v) => set('minutes', Number(v))}
            />
            <SChoice
              label="Minimum time between appointments"
              value={String(c.buffer)}
              options={[0, 15, 30, 45, 60, 75, 90, 105, 120].map((n) => ({
                value: String(n),
                label: n ? `${n} minutes` : 'None',
              }))}
              onChange={(v) => set('buffer', Number(v))}
            />
            <SChoice
              label="Minimum notice"
              value={String(c.notice)}
              options={[
                0, 15, 30, 60, 90, 120, 180, 240, 1440, 2880, 4320, 10080,
              ].map((n) => ({
                value: String(n),
                label:
                  n >= 1440
                    ? `${n / 1440} day(s)`
                    : n
                      ? `${n} minutes`
                      : 'None',
              }))}
              onChange={(v) => set('notice', Number(v))}
            />
            <SField
              label="Maximum days in future (blank = no limit)"
              type="number"
              value={c.maxDays ?? ''}
              onChange={(v) => set('maxDays', v === '' ? null : Number(v))}
            />
            <SChoice
              label="Prevent appointments during"
              value={c.bookings}
              options={['None', 'Assigned bookings only', 'All bookings']}
              onChange={(v) =>
                set('bookings', v as AppointmentCalendar['bookings'])
              }
            />
            <SChoice
              label="Prevent appointments during blockouts"
              value={c.blockouts}
              options={['None', 'Staff time off only', 'All blockout dates']}
              onChange={(v) =>
                set('blockouts', v as AppointmentCalendar['blockouts'])
              }
            />
          </div>
          <SToggle
            label="Enable online appointment requests"
            value={c.enabled}
            onChange={(v) => set('enabled', v)}
          />
          <h4>Weekly Appointment Availability</h4>
          <SToggle
            label="Same as weekly booking availability"
            value={c.sameWeek}
            onChange={(v) => set('sameWeek', v)}
          />
          {c.sameWeek ? (
            <WeekSummary week={weekFor(staff.data.bookingAvailability)} />
          ) : (
            <WeekEditor value={c.week} onChange={(v) => set('week', v)} />
          )}
        </>
      )}
      {tab === 'Meeting Details' && (
        <>
          <h4>Allowed appointment locations</h4>
          <section className="staff-box form-stack">
            <SToggle
              label="In Person"
              value={c.inPerson}
              onChange={(v) => set('inPerson', v)}
            />
            {c.inPerson && (
              <SField
                label="In Person Meeting Details"
                type="textarea"
                value={c.inPersonDetails}
                onChange={(v) => set('inPersonDetails', v)}
              />
            )}
          </section>
          <section className="staff-box form-stack">
            <SToggle
              label="Phone"
              value={c.phone}
              onChange={(v) => set('phone', v)}
            />
            {c.phone && (
              <>
                <SChoice
                  label="Who calls whom?"
                  value={c.phoneDirection}
                  options={[
                    'I will call the invitee',
                    'The invitee will call me',
                  ]}
                  onChange={(v) =>
                    set(
                      'phoneDirection',
                      v as AppointmentCalendar['phoneDirection'],
                    )
                  }
                />
                <SField
                  label="Phone Call Details"
                  type="textarea"
                  value={c.phoneDetails}
                  onChange={(v) => set('phoneDetails', v)}
                />
              </>
            )}
          </section>
          <section className="staff-box form-stack">
            <SToggle
              label="Other"
              value={c.other}
              onChange={(v) => set('other', v)}
            />
            {c.other && (
              <>
                <SField
                  label="Meeting Label"
                  required
                  value={c.otherLabel}
                  onChange={(v) => set('otherLabel', v)}
                />
                <SField
                  label="Meeting Details"
                  type="textarea"
                  value={c.otherDetails}
                  onChange={(v) => set('otherDetails', v)}
                />
              </>
            )}
          </section>
          <SField
            label="Invitation Message"
            type="textarea"
            value={c.invitation}
            onChange={(v) => set('invitation', v)}
          />
          <SField
            label="Confirmation Message"
            type="textarea"
            value={c.confirmation}
            onChange={(v) => set('confirmation', v)}
          />
          <p className="muted">
            Meeting details and confirmation text are added to approved
            appointments for review and sharing. They are not sent
            automatically.
          </p>
        </>
      )}
      {tab === 'Questions' && (
        <AppointmentQuestions
          value={c.questions}
          onChange={(v) => set('questions', v)}
        />
      )}
      {tab === 'Scheduling Link' &&
        (item.id ? (
          <>
            <CopyBlock
              label="Share this calendar's scheduling link"
              value={link}
            />
            <a
              className="secondary"
              href={link}
              target="_blank"
              rel="noreferrer"
            >
              Preview calendar
            </a>
            <p className="muted">
              Save changes before previewing. Site access settings apply to this
              link.
            </p>
          </>
        ) : (
          <p>Save this calendar to create its scheduling link.</p>
        ))}
      <div className="sales-actions">
        <button className="primary" disabled={busy}>
          Save scheduling calendar
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function AppointmentQuestions({
  value,
  onChange,
}: {
  value: AppointmentQuestion[];
  onChange: (q: AppointmentQuestion[]) => void;
}) {
  const [sample, setSample] = useState(questionSamples[0]),
    [editing, setEditing] = useState('');
  const patch = (id: string, d: Partial<AppointmentQuestion>) =>
    onChange(value.map((q) => (q.id === id ? { ...q, ...d } : q)));
  function add(label: string) {
    const id = crypto.randomUUID(),
      type =
        label === 'Event Date'
          ? 'date'
          : /Time| At$/.test(label)
            ? 'time'
            : /Count|Budget|Length/.test(label)
              ? 'number'
              : 'text';
    onChange([
      ...value,
      { id, label, hint: '', type, required: false, options: [] },
    ]);
    setEditing(id);
  }
  return (
    <div className="form-stack">
      <h4>Appointment intake questions</h4>
      <p className="muted">
        Location, name and email are required. Edit labels and hints, add sample
        or custom questions, and change their order.
      </p>
      {value.map((q, i) => {
        const locked = ['location', 'name', 'email'].includes(q.id);
        return (
          <section className="staff-box" key={q.id}>
            <div className="panel-heading">
              <div>
                <b>
                  {q.label}
                  {q.required ? ' *' : ''}
                </b>
                <p className="muted">{q.hint}</p>
              </div>
              <SActions
                label={`Question actions: ${q.label}`}
                items={[
                  {
                    label: 'Edit question',
                    action: () => setEditing(editing === q.id ? '' : q.id),
                  },
                  {
                    label: 'Move up',
                    disabled: i === 0,
                    action: () => {
                      const a = [...value];
                      [a[i], a[i - 1]] = [a[i - 1], a[i]];
                      onChange(a);
                    },
                  },
                  {
                    label: 'Move down',
                    disabled: i === value.length - 1,
                    action: () => {
                      const a = [...value];
                      [a[i], a[i + 1]] = [a[i + 1], a[i]];
                      onChange(a);
                    },
                  },
                  {
                    label: q.required ? 'Make optional' : 'Make required',
                    disabled: locked,
                    action: () => patch(q.id, { required: !q.required }),
                  },
                  {
                    label: 'Remove question',
                    disabled: locked,
                    action: () => onChange(value.filter((x) => x.id !== q.id)),
                  },
                ]}
              />
            </div>
            {editing === q.id && (
              <div className="form-stack">
                <SField
                  label="Question label"
                  value={q.label}
                  onChange={(label) => patch(q.id, { label })}
                />
                <SField
                  label="Hint"
                  value={q.hint}
                  onChange={(hint) => patch(q.id, { hint })}
                />
                {![
                  'location',
                  'name',
                  'email',
                  'phone',
                  'additional',
                  'notes',
                ].includes(q.id) && (
                  <SChoice
                    label="Answer type"
                    value={q.type}
                    options={[
                      'text',
                      'textarea',
                      'date',
                      'time',
                      'number',
                      'select',
                    ]}
                    onChange={(type) =>
                      patch(q.id, { type: type as AppointmentQuestion['type'] })
                    }
                  />
                )}{' '}
                {q.type === 'select' && q.id !== 'location' && (
                  <SField
                    label="Options (one per line)"
                    type="textarea"
                    value={q.options.join('\n')}
                    onChange={(s) => patch(q.id, { options: s.split('\n') })}
                  />
                )}
              </div>
            )}
          </section>
        );
      })}
      <div className="staff-week-row">
        <SChoice
          label="Question samples"
          value={sample}
          options={questionSamples}
          onChange={setSample}
        />
        <button type="button" className="secondary" onClick={() => add(sample)}>
          Add sample question
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => add('Custom question')}
        >
          Add custom question
        </button>
      </div>
    </div>
  );
}
