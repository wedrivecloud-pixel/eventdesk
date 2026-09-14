'use client';
import { useState } from 'react';
import { frequencyGroups } from '@/lib/frequency-reports';
import { balanceReports, balanceSorts } from '@/lib/balance-reports';
import { utilizationGroups, utilizationSorts } from '@/lib/utilization-reports';
import { availabilityReports, availabilitySorts } from '@/lib/availability-reports';
import { catalogReports, catalogSorts, catalogStatuses, catalogCategories, catalogGroups } from '@/lib/catalog-reports';
import { VoidPaymentButton, PaymentVoidAudit } from './payment-void';
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
  const [showVoided, setShowVoided] = useState(false);
  const [q, setQ] = useState(''),
    [method, setMethod] = useState('All methods'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const rows = [...(p.data.payments || []), ...(showVoided ? p.data.voidedPayments || [] : [])].sort((a,b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || '')).filter(
    (r) =>
      (method === 'All methods' || r.method === method) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      `${r.reference} ${p.data.events.find((e) => e.id === r.event_id)?.title}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const effectiveRows = rows.filter(r => !r.voided_at);
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
                'Status', 'Voided at', 'Voided by', 'Void reason',
              ],
              ...rows.map((r) => [
                r.date,
                p.data.events.find((e) => e.id === r.event_id)?.title,
                r.method,
                r.reference,
                r.amount / 100,
                (r.tip || 0) / 100,
                r.voided_at ? 'Voided' : 'Recorded', r.voided_at || '', r.voided_by_name || '', r.void_reason || '',
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
        <SToggle label="Show voided payments" value={showVoided} onChange={setShowVoided} />
      </div>
      <div className="sales-metrics">
        <article>
          <span>Payments</span>
          <strong>{money(effectiveRows.reduce((n, r) => n + r.amount, 0))}</strong>
        </article>
        <article>
          <span>Tips</span>
          <strong>{money(effectiveRows.reduce((n, r) => n + (r.tip || 0), 0))}</strong>
        </article>
        <article>
          <span>Total received</span>
          <strong>
            {money(effectiveRows.reduce((n, r) => n + r.amount + (r.tip || 0), 0))}
          </strong>
        </article>
      </div>
      <STable
        headers={['Date', 'Event', 'Method', 'Reference', 'Payment', 'Tip', 'Status', 'Action']}
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
            r.voided_at ? <PaymentVoidAudit payment={r} /> : 'Recorded',
            !r.voided_at && e ? <VoidPaymentButton payment={r} event={e} data={p.data} onData={p.onData} disabled={p.busy} /> : '—',
          ];
        })}
      />
    </section>
  );
}
function Reports(p: SalesProps) {
  const [utilizationDetail, setUtilizationDetail] = useState('');
  const [frequencyDetail, setFrequencyDetail] = useState('');
  const [tab, setTab] = useState('Default Reports'),
    [name, setName] = useState(''),
    [filter, setFilter] = useState<ReportFilter>({ ...blankReportFilter });
  const availability = availabilityReports.includes(name), weekly = name === 'Staff Availability';
  const catalog = catalogReports.includes(name);
  const utilization = name === 'Daily Utilization';
  const frequency = name === 'Most Frequently Booked';
  const balances = balanceReports.includes(name);
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
                  disabled={!!report.error}
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
                  disabled={!!report.error}
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
              {reportNames.filter((n) => !['Balances', 'Blockouts & Availability', 'Packages & Add-ons', 'Utilization'].includes(n)).map((n) => (
                <button
                  className="sales-report-card"
                  key={n}
                  onClick={() => {
                    setName(n);
                    setFilter({ ...blankReportFilter, ...(n === 'Daily Utilization' ? { utilizationDate: localToday(p.data) } : n === 'Most Frequently Booked' ? { from: localToday(p.data).slice(0, 4) + '-01-01', to: localToday(p.data).slice(0, 4) + '-12-31' } : {}) });
                  }}
                >
                  <span>{n === 'Daily Utilization' ? 'Utilization' : n}</span>
                  <small>
                    {['Email Event History', 'Login History'].includes(n)
                      ? 'Connection required'
                      : n === 'Message History'
                        ? 'Manually logged exchanges'
                        : n === 'Daily Utilization' ? 'Packages, add-ons, backdrops, bundles and staff' : 'View, filter and export'}
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
                r.data.report === 'Daily Utilization' ? r.data.utilizationDate : r.data.report === 'Staff Availability' ? 'Recurring weekly schedule' : catalogReports.includes(r.data.report) || r.data.report === 'Packages & Add-ons' ? 'Current catalog' : `${r.data.from || 'Any start'} – ${r.data.to || 'Any end'}`,
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
          {(balances || name === 'Balances') && <STabs tabs={balanceReports} value={name} onChange={(next) => { setName(next); setFilter({ ...blankReportFilter }); }} />}
          {(availability || name === 'Blockouts & Availability') && <STabs tabs={availabilityReports} value={name} onChange={(next) => { setName(next); setFilter({ ...blankReportFilter }); }} />}
          {(catalog || name === 'Packages & Add-ons') && <STabs tabs={catalogReports} value={name} onChange={(next) => { setName(next); setFilter({ ...blankReportFilter }); }} />}
          <p className="capability-note">{report.note}</p>
          {frequency && <STabs tabs={frequencyGroups} value={filter.group} onChange={(group) => { setFilter((old) => ({ ...old, group, columns: undefined })); setFrequencyDetail(''); }} />}
          {utilization && <STabs tabs={utilizationGroups} value={filter.group} onChange={(group) => { set('group', group); setUtilizationDetail(''); }} />}
          {availability && <div className="padded"><button className="secondary" onClick={() => p.onNavigate(name === 'Business Blockout Dates' ? 'Business settings' : 'Set Booking Availability')}>{name === 'Business Blockout Dates' ? 'Manage business blockouts' : 'Manage staff availability & time off'}</button></div>}
          {!!report.headers.length && (
            <>
              <div className="sales-filters">
                <SField
                  label="Search report"
                  value={filter.search}
                  onChange={(v) => set('search', v)}
                />
                {utilization && <><SField label="Utilization date" type="date" value={filter.utilizationDate || localToday(p.data)} onChange={(v) => { set('utilizationDate', v); setUtilizationDetail(''); }} /><SChoice label="Sort by" value={filter.sort || 'Name (A–Z)'} options={utilizationSorts} onChange={(v) => set('sort', v)} /></>}
                {name !== 'Packages & Add-ons' && !weekly && !catalog && !utilization && (
                  <>
                    <SField
                      label={balances ? 'Event date from' : 'From'}
                      type="date"
                      value={filter.from}
                      onChange={(v) => set('from', v)}
                    />
                    <SField
                      label={balances ? 'Event date to' : 'To'}
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
                {name === 'Utilization' && (
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
                {availability && name !== 'Business Blockout Dates' && <SChoice label="Staff member" value={filter.staffId || ''} onChange={(v) => set('staffId', v)} options={[
                  { value: '', label: 'All staff' },
                  ...(p.data.resources || []).filter((r) => r.kind === 'staff' && (!weekly || !r.archived)).map((r) => ({ value: r.id, label: r.name + (r.archived ? ' (archived)' : '') }))
                ]} />}
                {name === 'Staff Time Off' && <>
                  <SChoice label="Time-off status" value={filter.timeOffStatus || 'All'} onChange={(v) => set('timeOffStatus', v)} options={['All', 'Pending', 'Approved', 'Declined']} />
                  <SField label="Entered from" type="date" value={filter.enteredFrom || ''} onChange={(v) => set('enteredFrom', v)} />
                  <SField label="Entered to" type="date" value={filter.enteredTo || ''} onChange={(v) => set('enteredTo', v)} />
                </>}
                {availability && <SChoice label="Sort by" value={filter.sort || (weekly ? 'Staff (A–Z)' : 'Start (oldest first)')} onChange={(v) => set('sort', v)} options={weekly ? availabilitySorts.slice(4) : name === 'Business Blockout Dates' ? availabilitySorts.slice(0, 2) : availabilitySorts} />}
                {catalog && <>
                  {name === 'Packages' ? <>
                    <SChoice label="Service" value={filter.service || ''} onChange={(service) => setFilter((old) => ({ ...old, service, packageGroup: '' }))} options={[{ value: '', label: 'All services' }, ...[...new Set(p.data.packages.map((pkg) => pkg.service))].sort().map((s) => ({ value: s, label: s }))]} />
                    <SChoice label="Package group" value={filter.packageGroup || ''} onChange={(v) => set('packageGroup', v)} options={[{ value: '', label: 'All groups' }, ...catalogGroups(p.data, filter.service).map((g) => ({ value: g || '__ungrouped__', label: g || 'Ungrouped' }))]} />
                  </> : <SChoice label="Category" value={filter.categoryId || ''} onChange={(v) => set('categoryId', v)} options={[{ value: '', label: 'All categories' }, { value: '__uncategorized__', label: 'Uncategorized' }, ...catalogCategories(p.data, name).map((c) => ({ value: c.id, label: c.name + (c.archived ? ' (archived)' : '') }))]} />}
                  <SChoice label="Catalog status" value={filter.catalogStatus || (name === 'Packages' ? 'All' : 'Active')} onChange={(v) => set('catalogStatus', v)} options={catalogStatuses(name)} />
                  <SChoice label="Sort by" value={filter.sort || 'Name (A–Z)'} onChange={(v) => set('sort', v)} options={catalogSorts} />
                </>}
                {balances && <>
                  <SField label="Due date from" type="date" value={filter.dueFrom || ''} onChange={v => set('dueFrom', v)} />
                  <SField label="Due date to" type="date" value={filter.dueTo || ''} onChange={v => set('dueTo', v)} />
                  <SChoice label="Event status" value={filter.status === 'proposal' ? 'proposal' : 'confirmed'} options={[{ value: 'confirmed', label: 'Confirmed bookings' }, { value: 'proposal', label: 'Proposals' }]} onChange={v => set('status', v)} />
                  <SChoice label="Due status" value={filter.dueStatus || 'All'} options={['All', 'Past due', 'Due today', 'Upcoming']} onChange={v => set('dueStatus', v)} />
                  <SChoice label="Has payment plan" value={filter.hasPlan || 'All'} options={['All', 'Yes', 'No']} onChange={v => set('hasPlan', v)} />
                  <SChoice label="Service" value={filter.service || ''} options={[{ value: '', label: 'All services' }, ...[...new Set(p.data.events.flatMap(e => e.items.map(i => i.service)))].sort().map(s => ({ value: s, label: s }))]} onChange={v => set('service', v)} />
                  <SField label="Minimum remaining (USD)" type="number" value={filter.minAmount || ''} onChange={v => set('minAmount', v)} />
                  <SField label="Maximum remaining (USD)" type="number" value={filter.maxAmount || ''} onChange={v => set('maxAmount', v)} />
                  {name === 'Scheduled Payments' && <SChoice label="Payment type" value={filter.paymentType || 'All'} options={['All', 'Scheduled Payment', 'Final Balance']} onChange={v => set('paymentType', v)} />}
                  <SChoice label="Sort by" value={filter.sort || balanceSorts[0]} options={balanceSorts} onChange={v => set('sort', v)} />
                </>}
              </div>
              {report.error && <p role="alert" className="padded error">{report.error}</p>}
              {(availability || catalog || utilization || frequency || balances) && <details className="padded"><summary>Columns</summary><div className="sales-filters">{report.columns.map((column) => <SToggle key={column} label={column} value={report.headers.includes(column)} onChange={(checked) => {
                const next = checked ? [...report.headers, column] : report.headers.filter((c) => c !== column);
                if (next.length) setFilter((old) => ({ ...old, columns: next }));
              }} />)}</div><small className="muted">Keep at least one column. CSV exports use these columns.</small></details>}
              <p className="padded muted">{report.rows.length} matching rows</p>
              {balances && 'totals' in report && <div className="sales-metrics">{Object.entries(report.totals).map(([label, value]) => <article key={label}><span>{label.replace(' USD', '')}</span><strong>{money(Number(value) * 100)}</strong></article>)}</div>}
              <STable
                headers={report.headers}
                rows={report.rows.map((r, index) =>
                  r.map((v, col) =>
                    balances && report.headers[col] === 'Event' && 'balanceEventIds' in report ? <button className="record-link" onClick={() => { const e = p.data.events.find(e => e.id === report.balanceEventIds[index]); if (e) p.onOpen(e); }}>{String(v)}</button> : frequency && 'frequencyEntries' in report ? <button className="record-link" onClick={() => setFrequencyDetail(report.frequencyEntries[index].id)}>{typeof v === 'number' ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v) : String(v)}</button> : utilization && report.headers[col] === 'Name' && 'entries' in report ? <button className="record-link" onClick={() => setUtilizationDetail(report.entries[index].id)}>{String(v)}</button> : catalog && ['Title', 'Name'].includes(report.headers[col]) && p.onOpenCatalog && 'recordIds' in report && (name === 'Packages' || !p.data.resources?.find((item) => item.id === report.recordIds[index])?.archived) ? <button className="record-link" onClick={() => p.onOpenCatalog?.(name, report.recordIds[index])}>{String(v)}</button> : typeof v === 'number'
                      ? new Intl.NumberFormat('en-US', {
                          maximumFractionDigits: 2,
                        }).format(v)
                      : String(v ?? '—'),
                  ),
                )}
              />
              {frequency && 'frequencyEntries' in report && report.frequencyEntries.filter((r) => r.id === frequencyDetail).map((entry) => <div className="padded" key={entry.id}>
                <SHeader title={entry.name + ' · bookings'}><button className="secondary" onClick={() => setFrequencyDetail('')}>Close details</button></SHeader>
                <STable headers={['Booking', 'Scheduled date', 'Client']} rows={entry.eventIds.map((id) => { const e = p.data.events.find((e) => e.id === id)!; return [<button className="record-link" onClick={() => p.onOpen(e)}>{e.title}</button>, e.date, e.client]; })} />
              </div>)}
              {utilization && 'entries' in report && report.entries.filter((r) => r.id === utilizationDetail).map((entry) => <div className="padded" key={entry.id}>
                <SHeader title={entry.name + ' · reservations'}><button className="secondary" onClick={() => setUtilizationDetail('')}>Close details</button></SHeader>
                {!entry.reservations.length ? <p>No reservations overlap this date.</p> : <STable headers={['Booking / appointment', 'Start', 'End', 'Quantity']} rows={entry.reservations.map((r) => [
                  r.kind === 'booking' ? <button className="record-link" onClick={() => { const e = p.data.events.find((e) => e.id === r.id); if (e) p.onOpen(e); }}>{r.title}</button> : <button className="record-link" onClick={() => p.onNavigate('Appointments')}>{r.title}</button>,
                  new Date(r.start).toISOString().slice(0, 16).replace('T', ' '), new Date(r.end).toISOString().slice(0, 16).replace('T', ' '), r.quantity,
                ])} />}
                <button className="secondary" onClick={() => p.onNavigate(filter.group === 'Staff' ? 'Set Booking Availability' : filter.group === 'Add-ons' ? 'Add-ons' : filter.group === 'Backdrops' ? 'Backdrops' : 'Availability rules')}>{filter.group === 'Staff' ? 'Manage staff availability' : filter.group === 'Add-ons' || filter.group === 'Backdrops' ? 'Open catalog' : 'Manage shared availability limits'}</button>
              </div>)}
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
        'PRODID:-//Eventdeskly//Sales Calendar//EN',
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
    a.download = 'eventdeskly-calendar.ics';
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
