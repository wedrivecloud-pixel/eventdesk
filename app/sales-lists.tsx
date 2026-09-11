'use client';
import { assignedToMe, myAppointment } from '@/lib/user-account';
import { checklistInTodo } from '@/lib/checklist-catalog';
import { useState } from 'react';
import { money, prettyDate, type EventRecord } from '@/lib/crm';
import {
  activeEvent,
  balance,
  coverage,
  dateAdd,
  downloadCsv,
  expenseCategories,
  localToday,
  salesRows,
  type SalesRecord,
} from '@/lib/sales';
import {
  SField,
  SChoice,
  SToggle,
  STable,
  SActions,
  SHeader,
  STabs,
  staffOptions,
  staffName,
  type SalesProps,
} from './sales-ui';
const includes = (v: unknown, q: string) =>
  String(v ?? '')
    .toLowerCase()
    .includes(q.toLowerCase());
const within = (day: string, from: string, to: string) =>
  (!from || day >= from) && (!to || day <= to);
function recordEdit(p: SalesProps, r: SalesRecord) {
  p.edit({
    kind: r.kind,
    id: r.id,
    updatedAt: r.updated_at,
    data: {
      ...r.data,
      ...(r.kind === 'expense_rule' ? { amount: r.data.amount / 100 } : {}),
    },
  });
}
function archive(p: SalesProps, r: SalesRecord) {
  p.edit({
    kind: 'confirm',
    title: r.archived ? 'Restore record' : 'Archive record',
    data: {
      description:
        r.kind === 'expense_rule'
          ? 'Pausing keeps generated expenses. Resuming catches up any due occurrences.'
          : r.archived
            ? 'Return this record to the active list?'
            : 'Archive this record? You can restore it from the archived list.',
      body: {
        action: 'archive_record',
        id: r.id,
        updatedAt: r.updated_at,
        archived: !r.archived,
      },
    },
  });
}
function eventAction(p: SalesProps, ids: string[], lifecycle: string) {
  p.edit({
    kind: 'confirm',
    title:
      lifecycle === 'Active'
        ? 'Restore records'
        : `${lifecycle === 'Deleted' ? 'Move to trash' : lifecycle} records`,
    data: {
      description:
        lifecycle === 'Active'
          ? 'Restore these records? Previously confirmed bookings return to Proposals so availability can be checked again.'
          : `Apply this change to ${ids.length} selected record(s)? History and recorded payments are retained. Inactive bookings release availability.`,
      body: { action: 'event_lifecycle', ids, lifecycle },
    },
  });
}
export function SalesLists(p: SalesProps & { view: string }) {
  return p.view === 'Appointments' ? (
    <Appointments {...p} />
  ) : p.view === 'To-do List' ? (
    <Tasks {...p} />
  ) : p.view === 'Messages' ? (
    <Messages {...p} />
  ) : p.view === 'Staffing' ? (
    <Staffing {...p} />
  ) : p.view === 'Expenses' ? (
    <Expenses {...p} />
  ) : (
    <Events {...p} />
  );
}
function Appointments(p: SalesProps) {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState('All statuses'),
    [who, setWho] = useState('All appointments'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [sort, setSort] = useState('Date ascending'),
    [past, setPast] = useState('All dates'),
    today = localToday(p.data);
  const rows = salesRows(p.data, 'appointment', status === 'Archived')
    .filter(
      (r) =>
        (status === 'Archived'
          ? !!r.archived
          : !r.archived &&
            (status === 'All statuses' || r.data.status === status)) &&
        includes(Object.values(r.data).join(' '), q) &&
        within(r.data.date, from, to) &&
        (who === 'All appointments' || myAppointment(r,p.currentStaffId || '')) &&
        (past === 'All dates' ||
          (past === 'Future' ? r.data.date >= today : r.data.date < today)),
    )
    .sort((a, b) =>
      sort === 'Recently created'
        ? b.created_at.localeCompare(a.created_at)
        : (a.data.date + a.data.time).localeCompare(b.data.date + b.data.time) *
          (sort === 'Date descending' ? -1 : 1),
    );
  return (
    <section className="panel">
      <SHeader title={p.personal ? 'My appointments' : 'Appointments'}>
        <button
          className="primary"
          onClick={() => p.edit({ kind: 'appointment' })}
        >
          Schedule appointment
        </button>
        <button
          className="secondary"
          onClick={() =>
            downloadCsv('appointments', [
              [
                'Title',
                'Attendee',
                'Email',
                'Date',
                'Time',
                'Minutes',
                'Status',
                'Location',
              ],
              ...rows.map((r) => [
                r.data.title,
                r.data.name,
                r.data.email,
                r.data.date,
                r.data.time,
                r.data.minutes,
                r.data.status,
                r.data.details,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </SHeader>
      <div className="sales-filters">
        <SField label="Search appointments" value={q} onChange={setQ} />
        {!p.personal && <SChoice
          label="Appointments"
          value={who}
          onChange={setWho}
          options={['All appointments', 'My appointments']}
        />}
        <SChoice
          label="Status"
          value={status}
          onChange={setStatus}
          options={['Pending', 'Scheduled', 'Declined', 'Canceled', 'All statuses', 'Archived']}
        />
        <SChoice
          label="Date range"
          value={past}
          onChange={setPast}
          options={['All dates', 'Future', 'Past']}
        />
        <SField label="From" type="date" value={from} onChange={setFrom} />
        <SField label="To" type="date" value={to} onChange={setTo} />
        <SChoice
          label="Sort"
          value={sort}
          onChange={setSort}
          options={['Date ascending', 'Date descending', 'Recently created']}
        />
      </div>
      <STable
        headers={[
          'Appointment',
          'Attendee',
          'Date & time',
          'Organizer',
          'Status',
          'Actions',
        ]}
        rows={rows.map((r) => [
          <button
            className="record-link"
            onClick={() => recordEdit(p, r)}
            disabled={!!r.archived}
          >
            {r.data.title}
          </button>,
          <>
            {r.data.name}
            <small className="cell-sub">{r.data.email}</small>
          </>,
          <>
            {prettyDate(r.data.date)}
            <small className="cell-sub">
              {r.data.time} · {r.data.minutes} min · {r.data.location}
            </small>
          </>,
          staffName(p.data, r.data.organizer),
          r.archived ? 'Archived' : r.data.status,
          <SActions
            label={`Appointment actions: ${r.data.title}`}
            items={[
              ...(r.data.status === 'Pending' && !r.archived ? ['Scheduled','Declined'].map(status => ({
                label: status === 'Scheduled' ? 'Approve request' : 'Decline request',
                action:()=>p.run({action:'save_record',kind:'appointment',id:r.id,updatedAt:r.updated_at,data:{...r.data,status}}),
              })) : []),
              {
                label: 'Edit appointment',
                disabled: !!r.archived,
                action: () => recordEdit(p, r),
              },
              {
                label: 'Duplicate appointment',
                action: () =>
                  p.edit({
                    kind: 'appointment',
                    data: {
                      ...r.data,
                      title: r.data.title + ' (copy)',
                      status: 'Scheduled',
                    },
                  }),
              },
              {
                label: 'Create proposal',
                action: () =>
                  p.onCreateEvent({
                    title: r.data.title,
                    status: 'proposal',
                    client: r.data.name,
                    email: r.data.email,
                    phone: r.data.phone,
                  }),
              },
              ...(r.data.eventId
                ? [
                    {
                      label: 'View linked event',
                      action: () => {
                        const e = p.data.events.find(
                          (e) => e.id === r.data.eventId,
                        );
                        if (e) p.onOpen(e);
                      },
                    },
                  ]
                : []),
              {
                label:
                  r.data.status === 'Canceled'
                    ? 'Restore appointment'
                    : 'Cancel appointment',
                disabled: !!r.archived,
                action: () =>
                  p.run({
                    action: 'save_record',
                    id: r.id,
                    kind: r.kind,
                    updatedAt: r.updated_at,
                    data: {
                      ...r.data,
                      status:
                        r.data.status === 'Canceled' ? 'Scheduled' : 'Canceled',
                    },
                  }),
              },
              {
                label: r.archived ? 'Restore from archive' : 'Archive',
                action: () => archive(p, r),
              },
            ]}
          />,
        ])}
      />
    </section>
  );
}
function Tasks(p: SalesProps) {
  const [q, setQ] = useState(''),
    [filter, setFilter] = useState('Unchecked'),
    [assigned, setAssigned] = useState('All'),
    [sort, setSort] = useState('Due date'),
    [proposals, setProposals] = useState(!p.personal),
    today = localToday(p.data);
  const own = salesRows(p.data, 'task', filter === 'Archived').map((r) => ({
    id: r.id,
    title: r.data.title,
    notes: r.data.notes,
    due: r.data.due,
    assignee: r.data.assignee,
    eventId: r.data.eventId,
    done: r.data.done,
    created: r.created_at,
    archived: r.archived,
    record: r,
  }));
  const legacy = p.data.events.filter(activeEvent).flatMap((e) =>
    (e.operations?.tasks || []).filter(t => checklistInTodo(t, p.data.resources || [])).map((t) => ({
      id: e.id + ':' + t.id,
      title: t.label,
      notes: t.notes || '',
      due: t.due || '',
      assignee: t.assignee || '',
      eventId: e.id,
      done: t.done,
      created: e.created_at,
      archived: 0,
      legacyId: t.id,
      record: undefined as SalesRecord | undefined,
    })),
  );
  const rows = [...own, ...legacy]
    .filter((t) => {
      const e = p.data.events.find((e) => e.id === t.eventId);
      return (
        (filter === 'Archived' ? !!t.archived : !t.archived) &&
        (!e || activeEvent(e)) &&
        (proposals || e?.status !== 'proposal') &&
        includes(t.title + ' ' + t.notes + ' ' + e?.title, q) &&
        (assigned === 'All' ||
          (assigned === 'Assigned to me'
            ? assignedToMe(t.assignee,p.currentStaffId || '')
            : !t.assignee)) &&
        (filter === 'All' ||
          filter === 'Archived' ||
          (filter === 'Unchecked'
            ? !t.done
            : filter === 'Checked'
              ? t.done
              : filter === 'Past due'
                ? !!t.due && t.due < today && !t.done
                : filter === 'Due soon'
                  ? !!t.due &&
                    t.due >= today &&
                    t.due <= dateAdd(today, 7) &&
                    !t.done
                  : filter === 'No due date'
                    ? !t.due
                    : !!t.notes))
      );
    })
    .sort((a, b) =>
      sort === 'Recently created'
        ? b.created.localeCompare(a.created)
        : sort === 'Event date'
          ? (
              p.data.events.find((e) => e.id === a.eventId)?.date || '9999'
            ).localeCompare(
              p.data.events.find((e) => e.id === b.eventId)?.date || '9999',
            )
          : (a.due || '9999').localeCompare(b.due || '9999'),
    );
  return (
    <section className="panel">
      <SHeader title={p.personal ? 'My checklist' : 'To-do list'}>
        <button className="primary" onClick={() => p.edit({ kind: 'task' })}>
          New item
        </button>
      </SHeader>
      <div className="sales-filters">
        <SField label="Search tasks" value={q} onChange={setQ} />
        {!p.personal && <SChoice
          label="Assigned to"
          value={assigned}
          onChange={setAssigned}
          options={['All', 'Assigned to me', 'Unassigned']}
        />}
        <SChoice
          label="Show items"
          value={filter}
          onChange={setFilter}
          options={[
            'Unchecked',
            'Checked',
            'All',
            'Past due',
            'Due soon',
            'No due date',
            'With notes',
            'Archived',
          ]}
        />
        <SChoice
          label="Sort"
          value={sort}
          onChange={setSort}
          options={['Due date', 'Event date', 'Recently created']}
        />
        <SToggle
          label="Show proposals"
          value={proposals}
          onChange={setProposals}
        />
      </div>
      <STable
        headers={['Complete', 'Task', 'Due', 'Assigned to', 'Event', 'Actions']}
        rows={rows.map((t) => {
          const e = p.data.events.find((e) => e.id === t.eventId);
          return [
            <SToggle
              label={`Complete ${t.title}`}
              value={t.done}
              onChange={(done) => {
                if (p.busy || t.archived) return;
                if (t.record)
                  p.run({
                    action: 'save_record',
                    kind: 'task',
                    id: t.id,
                    updatedAt: t.record.updated_at,
                    data: { ...t.record.data, done },
                  });
                else
                  p.run({
                    action: 'legacy_task',
                    eventId: t.eventId,
                    id: 'legacyId' in t ? t.legacyId : '',
                    done,
                  });
              }}
            />,
            <>
              {t.title}
              <small className="cell-sub">
                {t.notes || (!t.record ? 'Event checklist item' : '')}
              </small>
            </>,
            t.due || 'No due date',
            staffName(p.data, t.assignee),
            e ? (
              <button className="record-link" onClick={() => p.onOpen(e)}>
                {e.title}
              </button>
            ) : (
              '—'
            ),
            t.record ? (
              <SActions
                items={[
                  {
                    label: 'Edit item',
                    disabled: !!t.archived,
                    action: () => recordEdit(p, t.record!),
                  },
                  {
                    label: t.archived ? 'Restore' : 'Archive',
                    action: () => archive(p, t.record!),
                  },
                ]}
              />
            ) : (
              <button
                className="text-button"
                onClick={() =>
                  p.edit({
                    kind: 'legacy_task',
                    id: 'legacyId' in t ? t.legacyId : '',
                    title: 'Edit checklist item',
                    data: {
                      title: t.title,
                      notes: t.notes,
                      due: t.due,
                      assignee: t.assignee,
                      done: t.done,
                      eventId: t.eventId,
                    },
                  })
                }
              >
                Edit item
              </button>
            ),
          ];
        })}
      />
    </section>
  );
}
export function Messages(p: SalesProps) {
  const [tab, setTab] = useState('Drafts'),
    [q, setQ] = useState(''),
    [channel, setChannel] = useState('All channels'),
    [copy, setCopy] = useState('');
  const states: Record<string, string[]> = {
    Drafts: ['Draft'],
    'Awaiting Review': ['Awaiting Review'],
    Reviewed: ['Reviewed'],
    'Scheduled drafts': ['Scheduled draft'],
    'Message History': ['Recorded incoming', 'Recorded outgoing'],
  };
  const rows = salesRows(p.data, 'message', tab === 'Archived').filter(
    (r) =>
      (tab === 'Archived'
        ? !!r.archived
        : !r.archived && (states[tab] || []).includes(r.data.state)) &&
      (channel === 'All channels' || r.data.channel === channel) &&
      includes(r.data.recipient + ' ' + r.data.subject + ' ' + r.data.body, q),
  );
  return (
    <section className="panel">
      <SHeader title="Messages">
        <button className="primary" onClick={() => p.edit({ kind: 'message' })}>
          Create draft
        </button>
        <button
          className="secondary"
          onClick={() =>
            p.edit({
              kind: 'message',
              data: { state: 'Recorded outgoing' },
              title: 'Log a message exchanged elsewhere',
            })
          }
        >
          Log message
        </button>
      </SHeader>
      <p className="capability-note">
        Email and text delivery are deferred. Review and schedule drafts here;
        no messages are sent automatically.
      </p>
      <STabs
        tabs={[
          'Drafts',
          'Awaiting Review',
          'Reviewed',
          'Scheduled drafts',
          'Message History',
          'Hard Bounces',
          'Archived',
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'Hard Bounces' ? (
        <p className="padded muted">
          Bounce tracking will become available after an email provider is
          connected. There is no delivery data to display yet.
        </p>
      ) : (
        <>
          <div className="sales-filters">
            <SField label="Search messages" value={q} onChange={setQ} />
            <SChoice
              label="Channel"
              value={channel}
              onChange={setChannel}
              options={['All channels', 'Email', 'SMS']}
            />
            <button
              className="secondary"
              onClick={() =>
                downloadCsv('message-' + tab, [
                  [
                    'Channel',
                    'Recipient',
                    'Subject',
                    'State',
                    'Planned date',
                    'Planned time',
                    'Saved',
                  ],
                  ...rows.map((r) => [
                    r.data.channel,
                    r.data.recipient,
                    r.data.subject,
                    r.data.state,
                    r.data.scheduledDate,
                    r.data.scheduledTime,
                    r.created_at,
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </div>
          {copy && (
            <p className="padded" role="status">
              {copy}
            </p>
          )}
          <STable
            headers={[
              'Message',
              'Recipient',
              'State',
              'Planned / saved',
              'Actions',
            ]}
            rows={rows.map((r) => [
              <button
                className="record-link"
                disabled={!!r.archived}
                onClick={() => recordEdit(p, r)}
              >
                {r.data.subject || r.data.body.slice(0, 60)}
                <small className="cell-sub">{r.data.channel}</small>
              </button>,
              r.data.recipient,
              r.archived ? 'Archived' : r.data.state,
              r.data.scheduledDate
                ? `${r.data.scheduledDate} ${r.data.scheduledTime}`
                : r.updated_at.slice(0, 10),
              <SActions
                items={[
                  {
                    label: 'Open / edit',
                    disabled: !!r.archived,
                    action: () => recordEdit(p, r),
                  },
                  {
                    label: 'Copy message text',
                    action: async () => {
                      try {
                        await navigator.clipboard.writeText(r.data.body);
                        setCopy('Message text copied.');
                      } catch {
                        setCopy(
                          'Clipboard unavailable. Open the draft to select and copy its text.',
                        );
                      }
                    },
                  },
                  ...(!r.archived && !r.data.state.startsWith('Recorded')
                    ? ['Awaiting Review', 'Reviewed']
                        .filter((s) => s !== r.data.state)
                        .map((state) => ({
                          label:
                            state === 'Reviewed'
                              ? 'Mark reviewed'
                              : 'Request review',
                          action: () =>
                            p.run({
                              action: 'save_record',
                              kind: 'message',
                              id: r.id,
                              updatedAt: r.updated_at,
                              data: { ...r.data, state },
                            }),
                        }))
                    : []),
                  {
                    label: r.archived ? 'Restore' : 'Archive',
                    action: () => archive(p, r),
                  },
                ]}
              />,
            ])}
          />
        </>
      )}
    </section>
  );
}
function Staffing(p: SalesProps) {
  const [tab, setTab] = useState('Overview'),
    [q, setQ] = useState(''),
    [all, setAll] = useState(false),
    [archived, setArchived] = useState(false),
    today = localToday(p.data),
    staff = (p.data.resources || []).filter(
      (r) => r.kind === 'staff' && !r.archived,
    ),
    events = p.data.events.filter(
      (e) =>
        activeEvent(e) && e.status === 'confirmed' && (all || e.date >= today),
    ),
    unassigned = events.filter((e) => coverage(e, p.data).missing > 0),
    timeoff = salesRows(p.data, 'time_off', archived).filter(
      (r) => !!r.archived === archived,
    );
  return (
    <section className="panel">
      <SHeader title="Staffing">
        <button
          className="secondary"
          onClick={() => p.onNavigate('Staff & user accounts')}
        >
          Manage team
        </button>
        <button
          className="primary"
          onClick={() => p.edit({ kind: 'time_off' })}
        >
          Add time off
        </button>
      </SHeader>
      <STabs
        tabs={['Overview', 'Unassigned Bookings', 'Time Off', 'Settings']}
        value={tab}
        onChange={setTab}
      />
      {tab === 'Settings' ? (
        <div className="padded form-stack">
          <h3>Assignment workflow</h3>
          <p>
            The business owner assigns staff and records time-off approvals
            here. Staff invitations, acceptance, self-service claiming, and
            check-in/out need a separate staff login workflow and are not
            connected.
          </p>
          <button
            className="secondary"
            onClick={() => p.onNavigate('Staff & user accounts')}
          >
            Edit staff roles and contact details
          </button>
        </div>
      ) : tab === 'Time Off' ? (
        <>
          <div className="sales-filters">
            <SToggle
              label="Show archived time off"
              value={archived}
              onChange={setArchived}
            />
          </div>
          <STable
            headers={['Staff', 'Dates', 'Approval', 'Notes', 'Actions']}
            rows={timeoff.map((r) => [
              staffName(p.data, r.data.staffId),
              `${r.data.start} – ${r.data.end}`,
              r.data.status,
              r.data.notes,
              <SActions
                items={[
                  {
                    label: 'Edit / approve',
                    disabled: !!r.archived,
                    action: () => recordEdit(p, r),
                  },
                  {
                    label: r.archived ? 'Restore' : 'Archive',
                    action: () => archive(p, r),
                  },
                ]}
              />,
            ])}
          />
        </>
      ) : (
        <>
          <div className="sales-filters">
            <SField label="Search bookings" value={q} onChange={setQ} />
            <SToggle
              label="Include past bookings"
              value={all}
              onChange={setAll}
            />
          </div>
          {tab === 'Overview' && (
            <div className="sales-metrics">
              <article>
                <span>Bookings needing staff</span>
                <strong>{unassigned.length}</strong>
              </article>
              <article>
                <span>Active team members</span>
                <strong>{staff.length}</strong>
              </article>
              <article>
                <span>Pending time off</span>
                <strong>
                  {timeoff.filter((r) => r.data.status === 'Pending').length}
                </strong>
              </article>
            </div>
          )}
          <STable
            headers={[
              'Booking',
              'Date',
              'Coverage',
              'Assigned staff',
              'Actions',
            ]}
            rows={(tab === 'Unassigned Bookings' ? unassigned : events)
              .filter((e) => includes(e.title + ' ' + e.client, q))
              .map((e) => {
                const c = coverage(e, p.data);
                return [
                  <button className="record-link" onClick={() => p.onOpen(e)}>
                    {e.title}
                  </button>,
                  e.date,
                  `${c.assigned.length} / ${c.required} required`,
                  c.assigned.map((id) => staffName(p.data, id)).join(', ') ||
                    'Unassigned',
                  <button
                    className="secondary"
                    onClick={() =>
                      p.edit({
                        kind: 'staff',
                        id: e.id,
                        title: 'Assign staff',
                        data: { staffIds: e.operations?.staffIds || [] },
                      })
                    }
                  >
                    Assign staff
                  </button>,
                ];
              })}
          />
        </>
      )}
    </section>
  );
}
function Expenses(p: SalesProps) {
  const [tab, setTab] = useState('Expenses'),
    [q, setQ] = useState(''),
    [category, setCategory] = useState('All categories'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [archived, setArchived] = useState(false);
  const categories = [
      ...new Set([
        ...expenseCategories,
        ...salesRows(p.data, 'expense_category').map((r) => r.data.name),
      ]),
    ],
    rows = (p.data.resources || []).filter(
      (r) =>
        r.kind === 'expenses' &&
        !!r.archived === archived &&
        includes(r.name + ' ' + r.data.reference + ' ' + r.data.notes, q) &&
        (category === 'All categories' || r.data.category === category) &&
        within(String(r.data.date || ''), from, to),
    ),
    rules = salesRows(p.data, 'expense_rule', true);
  return (
    <section className="panel">
      <SHeader title="Expenses">
        <button
          className="primary"
          onClick={() =>
            p.edit({
              kind:
                tab === 'Categories'
                  ? 'expense_category'
                  : tab === 'Automated Expenses'
                    ? 'expense_rule'
                    : 'expense',
            })
          }
        >
          {tab === 'Categories'
            ? 'New category'
            : tab === 'Automated Expenses'
              ? 'New expense rule'
              : 'New expense'}
        </button>
        {tab === 'Expenses' && (
          <>
            <button
              className="secondary"
              onClick={() =>
                p.edit({ kind: 'import', title: 'Import expenses' })
              }
            >
              Import CSV
            </button>
            <button
              className="secondary"
              onClick={() =>
                downloadCsv('expenses', [
                  ['payee', 'amount', 'date', 'category', 'reference', 'notes'],
                  ...rows.map((r) => [
                    r.name,
                    r.data.amount,
                    r.data.date,
                    r.data.category,
                    r.data.reference,
                    r.data.notes,
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </>
        )}
      </SHeader>
      <STabs
        tabs={['Expenses', 'Categories', 'Automated Expenses']}
        value={tab}
        onChange={setTab}
      />
      {tab === 'Expenses' ? (
        <>
          <div className="sales-filters">
            <SField
              label="Search payee or reference"
              value={q}
              onChange={setQ}
            />
            <SChoice
              label="Category"
              value={category}
              onChange={setCategory}
              options={['All categories', ...categories]}
            />
            <SField label="From" type="date" value={from} onChange={setFrom} />
            <SField label="To" type="date" value={to} onChange={setTo} />
            <SToggle
              label="Show archived"
              value={archived}
              onChange={setArchived}
            />
          </div>
          <div className="padded">
            <b>
              {money(
                rows.reduce(
                  (n, r) => n + Math.round(Number(r.data.amount || 0) * 100),
                  0,
                ),
              )}
            </b>{' '}
            across {rows.length} expenses
          </div>
          <STable
            headers={[
              'Payee / reference',
              'Date',
              'Category',
              'Linked event',
              'Amount',
              'Actions',
            ]}
            rows={rows.map((r) => {
              const e = p.data.events.find((e) => e.id === r.data.eventId);
              return [
                <>
                  {r.name}
                  <small className="cell-sub">
                    {r.data.reference}
                    {r.data.ruleId ? ' · Generated by rule' : ''}
                  </small>
                </>,
                r.data.date,
                r.data.category,
                e ? (
                  <button className="record-link" onClick={() => p.onOpen(e)}>
                    {e.title}
                  </button>
                ) : (
                  '—'
                ),
                money(Math.round(Number(r.data.amount) * 100)),
                <SActions
                  items={[
                    {
                      label: 'Edit / attachments',
                      disabled: !!r.archived,
                      action: () =>
                        p.edit({
                          kind: 'expense',
                          id: r.id,
                          data: { ...r.data, payee: r.name },
                        }),
                    },
                    {
                      label: r.archived ? 'Restore' : 'Archive',
                      action: () =>
                        p.edit({
                          kind: 'confirm',
                          title: r.archived
                            ? 'Restore expense'
                            : 'Archive expense',
                          data: {
                            description:
                              'Archived expenses are excluded from active expense totals. History is retained.',
                            body: {
                              action: 'archive_expense',
                              id: r.id,
                              archived: !r.archived,
                            },
                          },
                        }),
                    },
                  ]}
                />,
              ];
            })}
          />
        </>
      ) : tab === 'Categories' ? (
        <>
          <p className="padded muted">
            Standard categories are always available. Custom categories can be
            edited or archived; existing expenses retain their category label.
          </p>
          <STable
            headers={['Category', 'Type', 'Actions']}
            rows={[
              ...expenseCategories.map((name) => [name, 'Standard', '—']),
              ...salesRows(p.data, 'expense_category', true).map((r) => [
                r.data.name,
                r.archived ? 'Archived' : 'Custom',
                <SActions
                  items={[
                    {
                      label: 'Edit',
                      disabled: !!r.archived,
                      action: () => recordEdit(p, r),
                    },
                    {
                      label: r.archived ? 'Restore' : 'Archive',
                      action: () => archive(p, r),
                    },
                  ]}
                />,
              ]),
            ]}
          />
        </>
      ) : (
        <>
          <p className="capability-note">
            Due expenses are generated on workspace refresh. Each Booking rules
            apply to active confirmed bookings; monthly and yearly rules catch
            up from their first date. No background service is connected.
          </p>
          <STable
            headers={['Rule', 'Repeat', 'Payee', 'Amount', 'Status', 'Actions']}
            rows={rules.map((r) => [
              r.data.name,
              r.data.repeat,
              r.data.payeeMode === 'Each assigned staff'
                ? 'Each assigned staff'
                : r.data.payee,
              money(r.data.amount),
              r.archived ? 'Paused' : 'Active',
              <SActions
                items={[
                  {
                    label: 'Edit rule',
                    disabled: !!r.archived,
                    action: () => recordEdit(p, r),
                  },
                  {
                    label: r.archived ? 'Resume rule' : 'Pause rule',
                    action: () => archive(p, r),
                  },
                ]}
              />,
            ])}
          />
        </>
      )}
    </section>
  );
}
function Events(p: SalesProps & { view: string }) {
  const [q, setQ] = useState(''),
    [life, setLife] = useState('Active'),
    [need, setNeed] = useState('All records'),
    [heat, setHeat] = useState('Any temperature'),
    [source, setSource] = useState('Any source'),
    [origin, setOrigin] = useState('Any origin'),
    [assigned, setAssigned] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [createdFrom, setCreatedFrom] = useState(''),
    [createdTo, setCreatedTo] = useState(''),
    [sort, setSort] = useState('Event date ascending'),
    [selected, setSelected] = useState<string[]>([]),
    [when, setWhen] = useState('All dates');
  const today = localToday(p.data),
    status =
      p.view === 'Leads'
        ? 'lead'
        : p.view === 'Proposals'
          ? 'proposal'
          : 'confirmed';
  const rows = p.data.events
    .filter((e) => {
      const m = e.operations?.sales,
        paid = e.total - balance(e, p.data),
        expires = m?.expires || e.operations?.quote?.validUntil || '',
        hasBalance = balance(e, p.data) > 0;
      return (
        (p.view === 'Leads' && life === 'Converted'
          ? e.status !== 'lead'
          : e.status === status) &&
        (life === 'All statuses' || life === 'Converted'
          ? true
          : (e.lifecycle || 'Active') === life) &&
        includes(
          e.title +
            ' ' +
            e.client +
            ' ' +
            e.email +
            ' ' +
            e.venue +
            ' ' +
            e.phone,
          q,
        ) &&
        within(e.date, from, to) &&
        within(
          (p.view === 'Bookings'
            ? e.operations?.sales?.confirmedAt || e.created_at
            : e.created_at
          ).slice(0, 10),
          createdFrom,
          createdTo,
        ) &&
        (!assigned || e.operations?.staffIds?.includes(assigned)) &&
        (origin === 'Any origin' ||
          (m?.origin ||
            (e.source === 'Online booking request'
              ? 'Online booking'
              : 'Manual')) === origin) &&
        (source === 'Any source' || e.source === source) &&
        (heat === 'Any temperature' || m?.heat === heat) &&
        (when === 'All dates' ||
          (when === 'Future' ? e.date >= today : e.date < today)) &&
        (need === 'All records' ||
          (need === 'Awaiting deposit'
            ? paid < e.deposit
            : need === 'Outstanding balance'
              ? hasBalance
              : need === 'Past due balance'
                ? hasBalance &&
                  !!e.operations?.quote?.dueDate &&
                  e.operations.quote.dueDate < today
                : need === 'Awaiting review'
                  ? !!m?.review
                  : need === 'Awaiting signature'
                    ? !!e.operations?.contract && m?.signature !== 'Recorded'
                    : need === 'Incomplete questionnaires'
                      ? (e.operations?.questions || []).some(
                          (q) => !q.answer.trim(),
                        )
                      : need === 'Unassigned staff'
                        ? coverage(e, p.data).missing > 0
                        : need === 'Missing backdrop'
                          ? !e.operations?.quote?.backdropId
                          : need === 'No design selected'
                            ? !e.operations?.designId
                            : need === 'Expired proposals'
                              ? e.status === 'proposal' &&
                                !!expires &&
                                expires < today
                              : need === 'Expiring soon'
                                ? e.status === 'proposal' &&
                                  !!expires &&
                                  expires >= today &&
                                  expires <= dateAdd(today, 7)
                                : !!e.follow_up && e.follow_up <= today))
      );
    })
    .sort((a, b) =>
      sort === 'Recently created'
        ? b.created_at.localeCompare(a.created_at)
        : sort === 'Recently confirmed'
          ? (b.operations?.sales?.confirmedAt || '').localeCompare(
              a.operations?.sales?.confirmedAt || '',
            )
          : sort === 'Next follow-up'
            ? (a.follow_up || '9999').localeCompare(b.follow_up || '9999')
            : sort === 'Proposal expiration'
              ? (
                  a.operations?.sales?.expires ||
                  a.operations?.quote?.validUntil ||
                  '9999'
                ).localeCompare(
                  b.operations?.sales?.expires ||
                    b.operations?.quote?.validUntil ||
                    '9999',
                )
              : a.date.localeCompare(b.date) *
                (sort === 'Event date descending' ? -1 : 1),
    );
  const visibleSelected = selected.filter((id) =>
    rows.some((e) => e.id === id),
  );
  return (
    <section className="panel">
      <SHeader title={p.view}>
        <span>{rows.length} records</span>
        <SActions
          label="Bulk edit"
          items={[
            'Canceled',
            'Postponed',
            'Archived',
            'Spam',
            'Deleted',
            'Active',
          ].map((lifecycle) => ({
            label:
              lifecycle === 'Active'
                ? 'Restore selected'
                : lifecycle === 'Deleted'
                  ? 'Move selected to trash'
                  : lifecycle + ' selected',
            disabled: !visibleSelected.length,
            action: () => eventAction(p, visibleSelected, lifecycle),
          }))}
        />
        <span>Bulk edit ({visibleSelected.length})</span>
        <button
          className="secondary"
          onClick={() =>
            downloadCsv(p.view.toLowerCase(), [
              [
                'Event',
                'Client',
                'Email',
                'Date',
                'Time',
                'Stage',
                'Status',
                'Source',
                'Temperature',
                'Value USD',
                'Balance USD',
                'Follow-up',
              ],
              ...rows.map((e) => [
                e.title,
                e.client,
                e.email,
                e.date,
                e.time,
                e.status,
                e.lifecycle || 'Active',
                e.source,
                e.operations?.sales?.heat,
                e.total / 100,
                balance(e, p.data) / 100,
                e.follow_up,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </SHeader>
      <div className="sales-filters">
        <SField
          label={`Search ${p.view.toLowerCase()}`}
          value={q}
          onChange={setQ}
        />
        <SChoice
          label="Status"
          value={life}
          onChange={setLife}
          options={[
            'Active',
            'Canceled',
            'Postponed',
            'Archived',
            'Spam',
            'Deleted',
            'All statuses',
            ...(p.view === 'Leads' ? ['Converted'] : []),
          ]}
        />
        <SChoice
          label="Needs attention"
          value={need}
          onChange={setNeed}
          options={[
            'All records',
            'Awaiting deposit',
            'Outstanding balance',
            'Past due balance',
            'Awaiting review',
            'Awaiting signature',
            'Incomplete questionnaires',
            'Unassigned staff',
            'Missing backdrop',
            'No design selected',
            'Expired proposals',
            'Expiring soon',
            'Follow-up due',
          ]}
        />
        {p.view === 'Leads' && (
          <>
            <SChoice
              label="Origin"
              value={origin}
              onChange={setOrigin}
              options={['Any origin', 'Manual', 'Online booking']}
            />
            <SChoice
              label="Temperature"
              value={heat}
              onChange={setHeat}
              options={['Any temperature', 'Hot', 'Warm', 'Cold']}
            />
            <SChoice
              label="Source"
              value={source}
              onChange={setSource}
              options={[
                'Any source',
                ...[
                  ...new Set(
                    p.data.events.map((e) => e.source).filter(Boolean),
                  ),
                ],
              ]}
            />
          </>
        )}
        <SChoice
          label="Assigned staff"
          value={assigned}
          onChange={setAssigned}
          options={[
            { value: '', label: 'All staff' },
            ...staffOptions(p.data).filter((s) => s.value),
          ]}
        />
        <SChoice
          label="Dates"
          value={when}
          onChange={setWhen}
          options={['All dates', 'Future', 'Past']}
        />
        <SField
          label="Event date from"
          type="date"
          value={from}
          onChange={setFrom}
        />
        <SField label="Event date to" type="date" value={to} onChange={setTo} />
        <SField
          label={p.view === 'Bookings' ? 'Booked from' : 'Created from'}
          type="date"
          value={createdFrom}
          onChange={setCreatedFrom}
        />
        <SField
          label={p.view === 'Bookings' ? 'Booked to' : 'Created to'}
          type="date"
          value={createdTo}
          onChange={setCreatedTo}
        />
        <SChoice
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            'Event date ascending',
            'Event date descending',
            'Recently created',
            'Recently confirmed',
            'Next follow-up',
            'Proposal expiration',
          ]}
        />
      </div>
      <div className="padded">
        <SToggle
          label="Select all matching records (up to 100)"
          value={
            !!rows.length &&
            rows.slice(0, 100).every((e) => selected.includes(e.id))
          }
          onChange={(v) =>
            setSelected(v ? rows.slice(0, 100).map((e) => e.id) : [])
          }
        />
      </div>
      <STable
        headers={[
          'Select',
          'Event / client',
          'Date',
          'Status',
          'Value / balance',
          'Follow-up',
          'Actions',
        ]}
        rows={rows.map((e) => [
          <SToggle
            label={`Select ${e.title}`}
            value={visibleSelected.includes(e.id)}
            onChange={(v) =>
              setSelected(
                v
                  ? [...selected, e.id].slice(0, 100)
                  : selected.filter((id) => id !== e.id),
              )
            }
          />,
          <button className="record-link" onClick={() => p.onOpen(e)}>
            {e.title}
            <small className="cell-sub">
              {e.client}{' '}
              {e.operations?.sales?.heat ? '· ' + e.operations.sales.heat : ''}
            </small>
          </button>,
          <>
            {prettyDate(e.date)}
            <small className="cell-sub">{e.time}</small>
          </>,
          activeEvent(e) ? e.status : e.lifecycle,
          <>
            {money(e.total)}
            <small className="cell-sub">
              {money(balance(e, p.data))} balance
            </small>
          </>,
          e.follow_up || '—',
          <SActions
            label={`Actions for ${e.title}`}
            items={[
              { label: 'Overview / edit details', action: () => p.onOpen(e) },
              {
                label: 'Notes, temperature & review',
                action: () =>
                  p.edit({
                    kind: 'event_meta',
                    id: e.id,
                    title: 'Sales details',
                    data: {
                      heat: '',
                      signature: 'Awaiting',
                      ...e.operations?.sales,
                      followUp: e.follow_up,
                    },
                  }),
              },
              ...(activeEvent(e)
                ? [
                    {
                      label: 'Create appointment',
                      action: () =>
                        p.edit({
                          kind: 'appointment',
                          data: {
                            eventId: e.id,
                            title: `Meeting: ${e.title}`,
                            name: e.client,
                            email: e.email,
                            phone: e.phone,
                          },
                        }),
                    },
                    {
                      label: 'Create message draft',
                      action: () =>
                        p.edit({
                          kind: 'message',
                          data: {
                            eventId: e.id,
                            recipient: e.email,
                            subject: e.title,
                          },
                        }),
                    },
                    {
                      label: 'Add task',
                      action: () =>
                        p.edit({ kind: 'task', data: { eventId: e.id } }),
                    },
                    {
                      label: 'Assign staff',
                      action: () =>
                        p.edit({
                          kind: 'staff',
                          id: e.id,
                          data: { staffIds: e.operations?.staffIds || [] },
                        }),
                    },
                    ...[
                      'Canceled',
                      'Postponed',
                      'Archived',
                      'Spam',
                      'Deleted',
                    ].map((lifecycle) => ({
                      label:
                        lifecycle === 'Deleted' ? 'Move to trash' : lifecycle,
                      action: () => eventAction(p, [e.id], lifecycle),
                    })),
                  ]
                : [
                    {
                      label: 'Restore record',
                      action: () => eventAction(p, [e.id], 'Active'),
                    },
                  ]),
            ]}
          />,
        ])}
      />
    </section>
  );
}
