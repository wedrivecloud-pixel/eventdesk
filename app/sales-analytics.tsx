'use client';
import { useState } from 'react';
import { money, prettyDate } from '@/lib/crm';
import {
  activeEvent,
  balance,
  dateAdd,
  downloadCsv,
  localToday,
  occupiedDates,
  salesRows,
} from '@/lib/sales';
import {
  blankReportFilter,
  buildReport,
  reportNames,
  type ReportFilter,
} from '@/lib/sales-reports';
import {
  SField,
  SChoice,
  STable,
  SHeader,
  STabs,
  SToggle,
  SActions,
  staffOptions,
  staffName,
  type SalesProps,
} from './sales-ui';
export function SalesAnalytics(p: SalesProps & { view: string }) {
  return p.view === 'Reporting' ? (
    <Reports {...p} />
  ) : p.view === 'Calendar' ? (
    <Calendar {...p} />
  ) : (
    <Payments {...p} />
  );
}
function Payments(p: SalesProps) {
  const [q, setQ] = useState(''),
    [method, setMethod] = useState('All methods'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const rows = (p.data.payments || []).filter(
    (r) =>
      (method === 'All methods' || r.method === method) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      `${r.reference} ${p.data.events.find((e) => e.id === r.event_id)?.title}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <section className="panel">
      <SHeader title="Recorded payments">
        <button
          className="primary"
          onClick={() =>
            p.edit({ kind: 'payment', title: 'Record offline payment' })
          }
        >
          Record payment
        </button>
        <button
          className="secondary"
          onClick={() => p.onNavigate('Business settings')}
        >
          Payment settings
        </button>
        <button
          className="secondary"
          onClick={() =>
            downloadCsv('payments', [
              [
                'Date',
                'Event',
                'Method',
                'Reference',
                'Payment USD',
                'Tip USD',
              ],
              ...rows.map((r) => [
                r.date,
                p.data.events.find((e) => e.id === r.event_id)?.title,
                r.method,
                r.reference,
                r.amount / 100,
                (r.tip || 0) / 100,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </SHeader>
      <p className="capability-note">
        Online processing remains disconnected. Record payments already received
        by cash, check, bank transfer or an external provider.
      </p>
      <div className="sales-filters">
        <SField label="Search event or reference" value={q} onChange={setQ} />
        <SChoice
          label="Method"
          value={method}
          onChange={setMethod}
          options={[
            'All methods',
            'Cash',
            'Check',
            'Bank transfer',
            'External card payment',
            'Other',
          ]}
        />
        <SField label="From" type="date" value={from} onChange={setFrom} />
        <SField label="To" type="date" value={to} onChange={setTo} />
      </div>
      <div className="sales-metrics">
        <article>
          <span>Payments</span>
          <strong>{money(rows.reduce((n, r) => n + r.amount, 0))}</strong>
        </article>
        <article>
          <span>Tips</span>
          <strong>{money(rows.reduce((n, r) => n + (r.tip || 0), 0))}</strong>
        </article>
        <article>
          <span>Total received</span>
          <strong>
            {money(rows.reduce((n, r) => n + r.amount + (r.tip || 0), 0))}
          </strong>
        </article>
      </div>
      <STable
        headers={['Date', 'Event', 'Method', 'Reference', 'Payment', 'Tip']}
        rows={rows.map((r) => {
          const e = p.data.events.find((e) => e.id === r.event_id);
          return [
            r.date,
            e ? (
              <button className="record-link" onClick={() => p.onOpen(e)}>
                {e.title}
              </button>
            ) : (
              'Unavailable event'
            ),
            r.method,
            r.reference,
            money(r.amount),
            money(r.tip || 0),
          ];
        })}
      />
    </section>
  );
}
function Reports(p: SalesProps) {
  const [tab, setTab] = useState('Default Reports'),
    [name, setName] = useState(''),
    [filter, setFilter] = useState<ReportFilter>({ ...blankReportFilter });
  const report = buildReport(p.data, name, filter),
    set = (key: keyof ReportFilter, value: string) =>
      setFilter((old) => ({ ...old, [key]: value }));
  return (
    <section className="panel">
      <SHeader title={name ? name + ' report' : 'Reporting'}>
        {name && (
          <>
            <button className="secondary" onClick={() => setName('')}>
              Report library
            </button>
            {!!report.headers.length && (
              <>
                <button
                  className="secondary"
                  onClick={() =>
                    downloadCsv(name.toLowerCase().replaceAll(' ', '-'), [
                      report.headers,
                      ...report.rows,
                    ])
                  }
                >
                  Export CSV
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    p.edit({
                      kind: 'saved_report',
                      data: { ...filter, report: name, name: name + ' report' },
                    })
                  }
                >
                  Save report
                </button>
              </>
            )}
          </>
        )}
      </SHeader>
      {!name ? (
        <>
          <STabs
            tabs={['Default Reports', 'Saved Reports']}
            value={tab}
            onChange={setTab}
          />
          {tab === 'Default Reports' ? (
            <div className="sales-report-grid">
              {reportNames.map((n) => (
                <button
                  className="sales-report-card"
                  key={n}
                  onClick={() => {
                    setName(n);
                    setFilter({ ...blankReportFilter });
                  }}
                >
                  <span>{n}</span>
                  <small>
                    {['Email Event History', 'Login History'].includes(n)
                      ? 'Connection required'
                      : n === 'Message History'
                        ? 'Manually logged exchanges'
                        : 'View, filter and export'}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <STable
              headers={['Saved report', 'Type', 'Date range', 'Actions']}
              rows={salesRows(p.data, 'saved_report', true).map((r) => [
                <button
                  className="record-link"
                  onClick={() => {
                    setName(r.data.report);
                    setFilter({ ...blankReportFilter, ...r.data });
                  }}
                >
                  {r.data.name}
                </button>,
                r.data.report,
                `${r.data.from || 'Any start'} – ${r.data.to || 'Any end'}`,
                <SActions
                  items={[
                    {
                      label: r.archived ? 'Restore' : 'Archive',
                      action: () =>
                        p.run({
                          action: 'archive_record',
                          id: r.id,
                          updatedAt: r.updated_at,
                          archived: !r.archived,
                        }),
                    },
                    {
                      label: 'Rename',
                      disabled: !!r.archived,
                      action: () =>
                        p.edit({
                          kind: r.kind,
                          id: r.id,
                          updatedAt: r.updated_at,
                          data: r.data,
                        }),
                    },
                  ]}
                />,
              ])}
            />
          )}
        </>
      ) : (
        <>
          <p className="capability-note">{report.note}</p>
          {!!report.headers.length && (
            <>
              <div className="sales-filters">
                <SField
                  label="Search report"
                  value={filter.search}
                  onChange={(v) => set('search', v)}
                />
                {name !== 'Packages & Add-ons' && (
                  <>
                    <SField
                      label="From"
                      type="date"
                      value={filter.from}
                      onChange={(v) => set('from', v)}
                    />
                    <SField
                      label="To"
                      type="date"
                      value={filter.to}
                      onChange={(v) => set('to', v)}
                    />
                  </>
                )}
                {[
                  'Bookings',
                  'Leads',
                  'Balances',
                  'Payment History',
                  'Tips',
                  'Client List',
                  'Places',
                ].includes(name) && (
                  <SChoice
                    label="Event status"
                    value={filter.status}
                    onChange={(v) => set('status', v)}
                    options={[
                      'All',
                      'Active',
                      'Inactive',
                      'lead',
                      'proposal',
                      'confirmed',
                    ]}
                  />
                )}{' '}
                {['Most Frequently Booked', 'Utilization'].includes(name) && (
                  <SChoice
                    label="Group by"
                    value={filter.group}
                    onChange={(v) => set('group', v)}
                    options={[
                      'Packages',
                      'Add-ons',
                      'Backdrops',
                      'Staff',
                      'Customers',
                      'Referrers',
                    ]}
                  />
                )}
              </div>
              <p className="padded muted">{report.rows.length} matching rows</p>
              <STable
                headers={report.headers}
                rows={report.rows.map((r) =>
                  r.map((v) =>
                    typeof v === 'number'
                      ? new Intl.NumberFormat('en-US', {
                          maximumFractionDigits: 2,
                        }).format(v)
                      : String(v ?? '—'),
                  ),
                )}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
function Calendar(p: SalesProps) {
  const today = localToday(p.data),
    [day, setDay] = useState(today),
    [mode, setMode] = useState('Month'),
    [staff, setStaff] = useState(''),
    [show, setShow] = useState([
      'confirmed',
      'proposal',
      'Appointments',
      'Blockouts',
      'Staff off',
    ]);
  const toggles = [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'proposal', label: 'Proposals' },
    { value: 'lead', label: 'Leads' },
    { value: 'Inactive', label: 'Canceled / postponed / archived' },
    { value: 'Appointments', label: 'Appointments' },
    { value: 'Blockouts', label: 'Blockout dates' },
    { value: 'Staff off', label: 'Staff off' },
  ];
  const items: {
    id: string;
    from: string;
    to: string;
    title: string;
    time: string;
    kind: string;
    open: () => void;
  }[] = [];
  for (const e of p.data.events) {
    if (
      e.lifecycle === 'Deleted' ||
      e.lifecycle === 'Spam' ||
      (staff && !e.operations?.staffIds?.includes(staff)) ||
      (!activeEvent(e) ? !show.includes('Inactive') : !show.includes(e.status))
    )
      continue;
    const days = occupiedDates(e);
    items.push({
      id: e.id,
      from: e.date,
      to: days.at(-1) || e.date,
      title: e.title,
      time: e.time,
      kind: activeEvent(e) ? e.status : 'inactive',
      open: () => p.onOpen(e),
    });
  }
  if (show.includes('Appointments'))
    for (const r of salesRows(p.data, 'appointment'))
      if (
        ['Pending','Scheduled'].includes(r.data.status) &&
        (!staff ||
          r.data.staffIds?.includes(staff) ||
          r.data.organizer === staff)
      )
        items.push({
          id: r.id,
          from: r.data.date,
          to: r.data.date,
          title: r.data.title + (r.data.status === 'Pending' ? ' · Pending approval' : ''),
          time: r.data.time,
          kind: 'appointment',
          open: () =>
            p.edit({
              kind: r.kind,
              id: r.id,
              updatedAt: r.updated_at,
              data: r.data,
            }),
        });
  if (show.includes('Blockouts'))
    for (const d of String(p.data.settings?.blackoutDates || '')
      .split(/\s+/)
      .filter(Boolean))
      items.push({
        id: 'block:' + d,
        from: d,
        to: d,
        title: 'Business unavailable',
        time: '',
        kind: 'inactive',
        open: () => p.onNavigate('Business settings'),
      });
  if (show.includes('Staff off'))
    for (const r of salesRows(p.data, 'time_off'))
      if (r.data.status === 'Approved' && (!staff || r.data.staffId === staff))
        items.push({
          id: r.id,
          from: r.data.start,
          to: r.data.end,
          title: staffName(p.data, r.data.staffId) + ' · Time off',
          time: r.data.allDay === false ? r.data.startTime + '–' + r.data.endTime : '',
          kind: 'inactive',
          open: () =>
            p.edit({
              kind: r.kind,
              id: r.id,
              updatedAt: r.updated_at,
              data: r.data,
            }),
        });
  const date = new Date(day + 'T12:00:00'),
    start = new Date(date.getFullYear(), date.getMonth(), 1).getDay(),
    length = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const shift = (n: number) => {
    if (mode === 'Day') setDay(dateAdd(day, n));
    else {
      const m = new Date(
        Date.UTC(date.getFullYear(), date.getMonth() + n, 1, 12),
      );
      setDay(m.toISOString().slice(0, 10));
    }
  };
  function exportCalendar() {
    const esc = (v: string) =>
        v
          .replaceAll('\\', '\\\\')
          .replaceAll('\n', '\\n')
          .replaceAll(',', '\\,')
          .replaceAll(';', '\\;')
          .replaceAll('\r', ''),
      lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//EventDesk//Sales Calendar//EN',
        'CALSCALE:GREGORIAN',
        ...items.flatMap((i) => [
          'BEGIN:VEVENT',
          'UID:' + i.id + '@eventdesk',
          'DTSTAMP:' +
            new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
          'DTSTART;VALUE=DATE:' + i.from.replaceAll('-', ''),
          'DTEND;VALUE=DATE:' + dateAdd(i.to, 1).replaceAll('-', ''),
          'SUMMARY:' + esc(i.title),
          'DESCRIPTION:' +
            esc(
              (i.time ? 'Start time: ' + i.time + ' · ' : '') +
                String(p.data.settings?.timezone || 'America/Los_Angeles'),
            ),
          'END:VEVENT',
        ]),
        'END:VCALENDAR',
      ];
    const url = URL.createObjectURL(
      new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eventdesk-calendar.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel calendar-panel">
      <SHeader
        title={
          mode === 'Month'
            ? date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })
            : prettyDate(day)
        }
      >
        <button
          className="secondary"
          aria-label="Previous calendar period"
          onClick={() => shift(-1)}
        >
          Previous
        </button>
        <button className="secondary" onClick={() => setDay(today)}>
          Today
        </button>
        <button
          className="secondary"
          aria-label="Next calendar period"
          onClick={() => shift(1)}
        >
          Next
        </button>
        <button className="secondary" onClick={exportCalendar}>
          Export calendar
        </button>
        <button
          className="primary"
          onClick={() => p.edit({ kind: 'appointment', data: { date: day } })}
        >
          New appointment
        </button>
      </SHeader>
      <div className="sales-filters">
        <SChoice
          label="View"
          value={mode}
          onChange={setMode}
          options={['Month', 'Day']}
        />
        <SField
          label="Go to date"
          type="date"
          value={day}
          onChange={(v) => {
            if (v) setDay(v);
          }}
        />
        {!p.personal && <SChoice
          label="Assigned staff"
          value={staff}
          onChange={setStaff}
          options={[
            { value: '', label: 'All staff' },
            ...staffOptions(p.data).filter((s) => s.value),
          ]}
        />}
      </div>
      <div className="sales-calendar-toggles">
        {toggles.map((t) => (
          <SToggle
            key={t.value}
            label={t.label}
            value={show.includes(t.value)}
            onChange={(v) =>
              setShow(
                v ? [...show, t.value] : show.filter((x) => x !== t.value),
              )
            }
          />
        ))}
      </div>
      {mode === 'Month' ? (
        <div className="calendar-scroll">
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <strong className="weekday" key={d}>
                {d}
              </strong>
            ))}
            {Array.from({ length: start }, (_, i) => (
              <div className="day-cell outside" key={'blank' + i} />
            ))}
            {Array.from({ length }, (_, i) => {
              const d = day.slice(0, 7) + '-' + String(i + 1).padStart(2, '0');
              return (
                <div
                  className={'day-cell ' + (d === today ? 'sales-today' : '')}
                  key={d}
                >
                  <button
                    className="sales-day-number"
                    aria-label={`View ${d}`}
                    onClick={() => {
                      setDay(d);
                      setMode('Day');
                    }}
                  >
                    {i + 1}
                  </button>
                  {items
                    .filter((e) => e.from <= d && e.to >= d)
                    .map((e) => (
                      <button
                        className={'calendar-event ' + e.kind}
                        key={e.id}
                        onClick={e.open}
                      >
                        <small>{e.time}</small>
                        {e.title}
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <STable
          headers={['Event / appointment', 'Start', 'Dates', 'Type']}
          rows={items
            .filter((e) => e.from <= day && e.to >= day)
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((e) => [
              <button className="record-link" onClick={e.open}>
                {e.title}
              </button>,
              e.time || 'All day',
              e.from === e.to ? e.from : e.from + ' – ' + e.to,
              e.kind,
            ])}
        />
      )}
      <p className="capability-note">
        Calendar export is an all-day snapshot of the selected record types,
        with start times in the description. A live subscription and
        mini-session calendar are not connected.
      </p>
    </section>
  );
}
