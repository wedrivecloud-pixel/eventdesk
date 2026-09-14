'use client';
import { MediaPicker } from './manage-editors';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { money, type Data, type EventRecord } from '@/lib/crm';
import {
  localToday,
  salesRows,
  expenseCategories,
  activeEvent,
  parseCsv,
} from '@/lib/sales';
import {
  SField,
  SChoice,
  SToggle,
  STable,
  staffOptions,
  eventOptions,
  type Editor,
  type SalesProps,
} from './sales-ui';
import { SalesLists } from './sales-lists';
import { SalesAnalytics } from './sales-analytics';
import { SalesFiles } from './sales-files';
export function SalesWorkspace({
  view,
  data,
  onData,
  onOpen,
  onNavigate,
  onOpenCatalog,
  onCreateEvent,
  personal = false,
  currentStaffId = '',
  initialEditor = null,
}: {
  view: string;
  data: Data;
  onData: (d: Data) => void;
  onOpen: (e: EventRecord) => void;
  onNavigate: (s: string) => void;
  onOpenCatalog?: SalesProps['onOpenCatalog'];
  onCreateEvent: (d?: Partial<EventRecord>) => void;
  personal?: boolean;
  currentStaffId?: string;
  initialEditor?: Editor | null;
}) {
  const [editor, setEditor] = useState<Editor | null>(initialEditor),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function run(body: Record<string, unknown>, endpoint = '/api/sales') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        result = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(result.error || 'Unable to save.');
      onData(result);
      setNotice('Saved to your workspace.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const edit = (e: Editor) => {
    setError('');
    setEditor(e);
  };
  const props: SalesProps = {
    personal,
    currentStaffId,
    data,
    onData,
    onOpen,
    onNavigate,
    onOpenCatalog,
    onCreateEvent,
    edit,
    run,
    busy,
  };
  return (
    <div className="sales-workspace">
      {error && !editor && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="sales-notice" role="status">
          {notice}
        </p>
      )}
      {['Calendar', 'Payments', 'Reporting'].includes(view) ? (
        <SalesAnalytics {...props} view={view} />
      ) : (
        <SalesLists {...props} view={view} />
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditor(null);
            setError('');
          }
        }}
      >
        <DialogContent className="crm-dialog sales-dialog">
          <DialogHeader>
            <DialogTitle>
              {editor?.title ||
                (editor?.id ? 'Edit ' : 'New ') +
                  (editor?.kind.replaceAll('_', ' ') || 'record')}
            </DialogTitle>
            <DialogDescription>
              Saved privately in this business workspace.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {editor && (
            <SalesEditor
              key={editor.kind + editor.id + editor.updatedAt}
              editor={editor}
              {...props}
              onClose={() => setEditor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function SalesEditor({
  editor,
  data,
  run,
  busy,
  onClose,
  currentStaffId,
  personal,
}: SalesProps & { editor: Editor; onClose: () => void }) {
  const k = editor.kind,
    today = localToday(data),
    e = data.events.find((e) => e.id === editor.id);
  const [d, setD] = useState<Record<string, any>>(() => ({
    date: today,
    start: today,
    end: k === 'time_off' ? today : '',
    time: '10:00',
    minutes: 30,
    location: 'In Person',
    organizer: personal && currentStaffId ? currentStaffId : 'owner',
    assignee: personal ? (currentStaffId || 'owner') : '',
    status: k === 'time_off' ? 'Approved' : 'Scheduled',
    staffIds: [],
    done: false,
    channel: 'Email',
    state: 'Draft',
    repeat: 'Each Booking',
    payeeMode: 'Custom',
    dateBasis: 'Event date',
    packageIds: [],
    category: 'Other',
    ...editor.data,
  }));
  const [importRows, setImportRows] = useState<Record<string, any>[]>([]),
    [fileError, setFileError] = useState('');
  const change = (key: string, value: any) =>
    setD((old) => ({ ...old, [key]: value }));
  const field = (
    key: string,
    label: string,
    type = 'text',
    required = false,
  ) => (
    <SField
      label={label}
      value={d[key]}
      onChange={(v) => change(key, v)}
      type={type}
      required={required}
    />
  );
  const choice = (
    key: string,
    label: string,
    options: (string | { value: string; label: string })[],
  ) => (
    <SChoice
      label={label}
      value={d[key]}
      onChange={(v) => change(key, v)}
      options={options}
    />
  );
  const linked = (
    <SChoice
      label="Linked event"
      value={d.eventId || ''}
      options={eventOptions(data)}
      onChange={(v) => {
        const ev = data.events.find((e) => e.id === v);
        setD((old) => ({
          ...old,
          eventId: v,
          ...(k === 'message' && ev
            ? { recipient: old.channel === 'SMS' ? ev.phone : ev.email }
            : {}),
          ...(k === 'appointment' && ev
            ? { name: ev.client, email: ev.email, phone: ev.phone }
            : {}),
        }));
      }}
    />
  );
  const staffMulti = (
    <div className="field">
      <span>Staff attendees</span>
      <div className="sales-checks">
        {staffOptions(data)
          .filter((s) => s.value)
          .map((s) => (
            <SToggle
              key={s.value}
              label={s.label}
              value={(d.staffIds || []).includes(s.value)}
              onChange={(v) =>
                change(
                  'staffIds',
                  v
                    ? [...(d.staffIds || []), s.value]
                    : (d.staffIds || []).filter((x: string) => x !== s.value),
                )
              }
            />
          ))}
      </div>
      {staffOptions(data).length === 1 && (
        <p className="muted">Add team members under Manage → Staff first.</p>
      )}
    </div>
  );
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    let body: Record<string, unknown>,
      endpoint = '/api/sales';
    if (k === 'confirm') body = d.body;
    else if (k === 'legacy_task')
      body = {
        action: 'legacy_task_data',
        eventId: d.eventId,
        id: editor.id,
        data: d,
      };
    else if (k === 'expense')
      body = {
        action: 'save_expense',
        id: editor.id,
        data: { ...d, amount: Math.round(Number(d.amount) * 100) },
      };
    else if (k === 'import')
      body = { action: 'import_expenses', rows: importRows };
    else if (k === 'event_meta')
      body = { action: 'event_meta', id: editor.id, data: d };
    else if (k === 'staff') {
      endpoint = '/api/manage';
      body = {
        action: 'save_planning',
        eventId: editor.id,
        staffIds: d.staffIds,
      };
    } else if (k === 'payment') {
      endpoint = '/api/manage';
      body = {
        action: 'record_payment',
        eventId: d.eventId,
        amount: Math.round(Number(d.amount || 0) * 100),
        tip: Math.round(Number(d.tip || 0) * 100),
        method: d.method || 'Cash',
        date: d.date,
        reference: d.reference || '',
      };
    } else
      body = {
        action: 'save_record',
        kind: k,
        id: editor.id,
        updatedAt: editor.updatedAt,
        data: {
          ...d,
          ...(k === 'appointment' ? { minutes: Number(d.minutes) } : {}),
          ...(k === 'expense_rule'
            ? { amount: Math.round(Number(d.amount) * 100) }
            : {}),
        },
      };
    if (await run(body, endpoint)) onClose();
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      {k === 'confirm' ? (
        <p>{d.description}</p>
      ) : k === 'appointment' ? (
        <>
          <div className="form-grid">
            {field('title', 'Appointment title', 'text', true)}
            {linked}
            {field('name', 'Attendee name', 'text', true)}
            {field('email', 'Attendee email', 'email', true)}
            {field('phone', 'Phone', 'tel')}
            {field(
              'additional',
              'Additional attendee emails (comma separated)',
            )}
            {field('date', 'Scheduled date', 'date', true)}
            {field('time', 'Start time', 'time', true)}
            {choice(
              'minutes',
              'Length',
              [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720].map((n) => ({
                value: String(n),
                label: `${n} minutes`,
              })),
            )}
            {choice('location', 'Meeting type', [
              'In Person',
              'Phone',
              'Video call',
              'Other',
            ])}
            {choice(
              'organizer',
              'Organizer',
              staffOptions(data, true).filter((x) => x.value),
            )}
            {choice('status', 'Status', ['Pending', 'Scheduled', 'Declined', 'Canceled'])}
          </div>
          {field('details', 'Location or call details')}
          {field('notes', 'Private notes', 'textarea')}
          {d.calendarId && <section className="staff-box"><h4>Appointment request answers</h4>{Object.entries(d.answers||{}).map(([key,value])=><p key={key}><b>{String(d.questionLabels?.[key]||key)}:</b> {String(value)}</p>)}{d.confirmationMessage&&<p><b>Confirmation text:</b> {String(d.confirmationMessage)}</p>}<p className="muted">Approval reserves the time after checking availability. Confirmation messages are not sent automatically.</p></section>}
          {staffMulti}
          <p className="capability-note">
            Appointment reminders can be prepared in Messages. Email and text
            delivery will be connected later.
          </p>
        </>
      ) : k === 'task' || k === 'legacy_task' ? (
        <>
          <div className="form-grid">
            {field('title', 'Title', 'text', true)}
            {k === 'task' && linked}
            {choice('assignee', 'Assigned to', staffOptions(data, true))}
            {field('due', 'Due date', 'date')}
          </div>
          {field('notes', 'Additional notes', 'textarea')}
          <SToggle
            label="Completed"
            value={!!d.done}
            onChange={(v) => change('done', v)}
          />
        </>
      ) : k === 'message' ? (
        <>
          <p className="capability-note">
            Drafts and review only. Planned dates do not trigger delivery.
            History records are messages you manually log as already exchanged.
          </p>
          <div className="form-grid">
            {linked}
            <SChoice
              label="Use a template"
              value=""
              options={[
                { value: '', label: 'Choose a template' },
                ...(data.resources || [])
                  .filter((r) => r.kind === 'messages' && !r.archived)
                  .map((r) => ({ value: r.id, label: r.name })),
              ]}
              onChange={(v) => {
                const r = data.resources?.find((r) => r.id === v);
                if (r)
                  setD((old) => ({
                    ...old,
                    subject: r.data.subject || r.name,
                    body: r.data.body || '',
                  }));
              }}
            />
            {choice('channel', 'Channel', ['Email', 'SMS'])}
            {field(
              'recipient',
              d.channel === 'SMS' ? 'Recipient phone' : 'Recipient email',
              d.channel === 'SMS' ? 'tel' : 'email',
              true,
            )}
            {field('subject', 'Subject')}
            {choice('state', 'Review status', [
              'Draft',
              'Awaiting Review',
              'Reviewed',
              'Scheduled draft',
              'Recorded incoming',
              'Recorded outgoing',
            ])}
          </div>
          {field('body', 'Message', 'textarea', true)}
          <MediaPicker
            data={data}
            documents
            ids={Array.isArray(d.attachments) ? d.attachments : []}
            onChange={(v) => change('attachments', v)}
          />
          {d.state === 'Scheduled draft' && (
            <div className="form-grid">
              {field('scheduledDate', 'Planned date', 'date', true)}
              {field('scheduledTime', 'Planned time', 'time', true)}
            </div>
          )}
          {field('notes', 'Internal notes', 'textarea')}
        </>
      ) : k === 'time_off' ? (
        <>
          <SToggle label="All day" value={d.allDay!==false} onChange={v=>change('allDay',v)}/>
          <div className="form-grid">
            {choice('staffId', 'Team member', staffOptions(data))}
            {choice('status', 'Approval', ['Pending', 'Approved', 'Declined'])}
            {field('start', 'First day', 'date', true)}
            {field('end', 'Last day', 'date', true)}
            {d.allDay===false&&field('startTime','Start time','time',true)}
            {d.allDay===false&&field('endTime','End time','time',true)}
          </div>
          {field('notes', 'Notes', 'textarea')}
        </>
      ) : k === 'expense_category' ? (
        field('name', 'Category name', 'text', true)
      ) : k === 'expense' || k === 'expense_rule' ? (
        <>
          {k === 'expense_rule' && (
            <>
              <p className="capability-note">
                Rules create due expenses when you open or save the workspace.
                Pausing a rule keeps previously generated expenses. Each
                occurrence is generated once.
              </p>
              <div className="form-grid">
                {field('name', 'Rule name', 'text', true)}
                {choice('repeat', 'Repeat', [
                  'Each Booking',
                  'Monthly',
                  'Yearly',
                ])}
                {field('start', 'First date', 'date', true)}
                {field('end', 'Last date (optional)', 'date')}
                {d.repeat === 'Each Booking' &&
                  choice('dateBasis', 'Expense date', [
                    'Event date',
                    'Confirmation date',
                  ])}
              </div>
              {d.repeat === 'Each Booking' && (
                <div className="field">
                  <span>Apply to packages (none selected means all)</span>
                  <div className="sales-checks">
                    {data.packages.map((p) => (
                      <SToggle
                        key={p.id}
                        label={p.name}
                        value={d.packageIds.includes(p.id)}
                        onChange={(v) =>
                          change(
                            'packageIds',
                            v
                              ? [...d.packageIds, p.id]
                              : d.packageIds.filter((x: string) => x !== p.id),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="form-grid">
            {choice(
              'payeeMode',
              'Payee type',
              k === 'expense'
                ? ['Custom', 'Staff']
                : d.repeat === 'Each Booking'
                  ? ['Custom', 'Each assigned staff']
                  : ['Custom'],
            )}
            {d.payeeMode === 'Staff' ? (
              <SChoice
                label="Staff payee"
                value={d.staffId || ''}
                options={staffOptions(data)}
                onChange={(v) =>
                  setD((old) => ({
                    ...old,
                    staffId: v,
                    payee: data.resources?.find((r) => r.id === v)?.name || '',
                  }))
                }
              />
            ) : d.payeeMode === 'Custom' ? (
              field('payee', 'Payee', 'text', true)
            ) : null}
            {field('amount', 'Amount (USD)', 'number', true)}
            {k === 'expense' && field('date', 'Expense date', 'date', true)}
            {choice('category', 'Category', [
              ...new Set([
                ...expenseCategories,
                ...salesRows(data, 'expense_category').map((r) => r.data.name),
                d.category || 'Other',
              ]),
            ])}
            {field('reference', 'Reference', 'text', true)}
            {k === 'expense' && linked}
          </div>
          {field('notes', 'Description', 'textarea')}
          {k === 'expense' && editor.id && (
            <SalesFiles data={data} id={editor.id} />
          )}
        </>
      ) : k === 'staff' ? (
        <>
          <p>
            Assign staff to {e?.title}. Staff availability is checked before
            saving a confirmed booking.
          </p>
          {staffMulti}
        </>
      ) : k === 'event_meta' ? (
        <>
          <div className="form-grid">
            {choice('heat', 'Lead temperature', [
              { value: '', label: 'Not set' },
              'Hot',
              'Warm',
              'Cold',
            ])}
            {field('followUp', 'Next follow-up', 'date')}
            {field('expires', 'Proposal expiration override', 'date')}
            {choice('signature', 'Signature record', ['Awaiting', 'Recorded'])}
            {d.signature === 'Recorded' &&
              field('signatureDate', 'Date signed externally', 'date', true)}
          </div>
          <p className="capability-note">
            Signature records track an agreement signed elsewhere. Electronic
            signatures are not connected.
          </p>
          <SToggle
            label="Needs review"
            value={!!d.review}
            onChange={(v) => change('review', v)}
          />
          <SToggle
            label="Pause automated message eligibility"
            value={!!d.automationsPaused}
            onChange={(v) => change('automationsPaused', v)}
          />
          {field('notes', 'Internal sales notes', 'textarea')}
        </>
      ) : k === 'payment' ? (
        <>
          <p className="capability-note">
            Record a payment already received outside Eventdeskly. No charge will
            be made. Tips are separate from the event balance.
          </p>
          <div className="form-grid">
            {linked}
            {field('date', 'Payment date', 'date', true)}
            {field('amount', 'Payment toward balance (USD)', 'number', true)}
            {field('tip', 'Tip (USD)', 'number')}
            {choice('method', 'Method', [
              'Cash',
              'Check',
              'Bank transfer',
              'External card payment',
              'Other',
            ])}
            {field('reference', 'Reference')}
          </div>
        </>
      ) : k === 'saved_report' ? (
        <>
          {field('name', 'Saved report name', 'text', true)}
          <p>
            {d.report} · {['Packages', 'Add-ons', 'Backdrops', 'Packages & Add-ons'].includes(d.report) ? 'Current catalog' : `${d.from || 'Any start'} to ${d.to || 'Any end'}`}
          </p>
        </>
      ) : k === 'import' ? (
        <>
          <p>
            Import up to 200 expenses. CSV headers:{' '}
            <b>payee, amount, date, category, reference, notes</b>. Amounts are
            in USD; dates use YYYY-MM-DD. All rows are validated before any are
            saved.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Expense CSV"
            onChange={async (ev) => {
              setImportRows([]);
              setFileError('');
              try {
                const file = ev.target.files?.[0];
                if (!file) return;
                if (file.size > 1000000) throw Error('CSV must be under 1 MB.');
                const rows = parseCsv(await file.text()),
                  head = rows.shift()?.map((x) => x.trim().toLowerCase()) || [];
                for (const h of ['payee', 'amount', 'date', 'reference'])
                  if (!head.includes(h)) throw Error('Missing column: ' + h);
                const result = rows.map((row, index) => {
                  const r = Object.fromEntries(
                    head.map((h, i) => [h, row[i] || '']),
                  );
                  if (
                    !r.payee ||
                    !r.reference ||
                    !/^\d+(\.\d{1,2})?$/.test(r.amount) ||
                    Number(r.amount) <= 0 ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(r.date)
                  )
                    throw Error(
                      `Check payee, reference, amount and date on row ${index + 2}.`,
                    );
                  return {
                    ...r,
                    amount: Math.round(Number(r.amount) * 100),
                    payeeMode: 'Custom',
                  };
                });
                setImportRows(result);
              } catch (e) {
                setFileError(e instanceof Error ? e.message : 'Invalid file.');
              }
            }}
          />
          {fileError && (
            <p className="error" role="alert">
              {fileError}
            </p>
          )}
          <STable
            headers={['Payee', 'Date', 'Amount', 'Reference']}
            rows={importRows
              .slice(0, 20)
              .map((r) => [r.payee, r.date, money(r.amount), r.reference])}
          />
          <p>{importRows.length} rows ready. Preview shows the first 20.</p>
        </>
      ) : null}
      <div className="form-footer">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy || (k === 'import' && !importRows.length)}
        >
          {busy
            ? 'Saving…'
            : k === 'confirm'
              ? 'Confirm'
              : k === 'import'
                ? `Import ${importRows.length} expenses`
                : 'Save'}
        </button>
      </div>
    </form>
  );
}
