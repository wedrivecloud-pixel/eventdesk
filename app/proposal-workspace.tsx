'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Mail, Copy, Eye, ArrowRight, Printer, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { money, prettyDate, type Data, type EventRecord } from '@/lib/crm';
import { activeEvent } from '@/lib/sales';
import { invoiceDetails, proposalSummary, proposalTabs } from '@/lib/proposal';
import { ClientSubmission, EventPlanning, QuoteBreakdown } from './event-tools';
import { EventAttachments } from './event-attachments';
import { ProposalDocument } from './proposal-document';
import { Messages } from './sales-lists';
import { SalesEditor } from './sales-workspace';
import { SField, type Editor, type SalesProps } from './sales-ui';
import type { Save } from './forms';
import './proposal-workspace.css';
export function ProposalWorkspace({
  item: e,
  data,
  onData,
  onSave,
  onEdit,
  onConfirm,
  onReopen,
  busy,
  initialTab = 'Overview',
}: {
  item: EventRecord;
  data: Data;
  onData: (d: Data) => void;
  onSave: Save;
  onEdit: () => void;
  onConfirm: () => void;
  onReopen: () => void;
  busy: boolean;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [link, setLink] = useState(''),
    [revoke, setRevoke] = useState(false),
    [deleting, setDeleting] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [invoiceEdit, setInvoiceEdit] = useState(false),
    [invoice, setInvoice] = useState(() => invoiceDetails(e));
  const active = activeEvent(e),
    blocked = busy || working,
    summary = proposalSummary(
      e,
      (data.payments || []).filter((p) => p.event_id === e.id),
    ),
    business = data.business!,
    ops = e.operations || {};
  async function run(body: Record<string, unknown>, endpoint = '/api/sales') {
    setWorking(true);
    setError('');
    try {
      const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        j = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw Error(j.error || 'Unable to save.');
      onData(j);
      setNotice('Saved to this proposal.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
      return false;
    } finally {
      setWorking(false);
    }
  }
  async function share(copy = false) {
    setWorking(true);
    setError('');
    try {
      const r = await fetch('/api/proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'share_link', eventId: e.id }),
        }),
        j = (await r.json()) as { path: string; error?: string };
      if (!r.ok) throw Error(j.error);
      const url = new URL(j.path, window.location.origin).href;
      setLink(url);
      if (copy) {
        try {
          await navigator.clipboard.writeText(url);
          setNotice('Client proposal link copied.');
        } catch {
          setNotice('Select and copy the link below.');
        }
      }
      return url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to prepare the link.',
      );
      return '';
    } finally {
      setWorking(false);
    }
  }
  const editMessage = (edit: Editor) =>
    setEditor({
      ...edit,
      data: { eventId: e.id, recipient: e.email, ...edit.data },
    });
  async function emailDraft() {
    const url = await share();
    if (!url) return;
    setTab('Messages');
    editMessage({
      kind: 'message',
      title: 'Prepare proposal email',
      data: {
        channel: 'Email',
        state: 'Draft',
        subject: 'Proposal: ' + e.title,
        body:
          'Hi ' +
          e.client +
          ',\n\nYour event proposal is ready to review:\n' +
          url +
          '\n\nPlease contact us with any questions or to arrange acceptance.\n\n' +
          business.name,
      },
    });
  }
  const scoped = {
    ...data,
    events: [e],
    sales: (data.sales || []).filter(
      (r) => r.kind === 'message' && r.data.eventId === e.id,
    ),
  };
  const messageProps: SalesProps = {
    data: scoped,
    onOpen: () => {},
    onNavigate: () => {},
    onCreateEvent: () => {},
    edit: editMessage,
    run,
    busy: blocked || !active,
  };
  const changeTab = (v: unknown) => {
    setTab(String(v));
    setError('');
  };
  return (
    <div className="proposal-workspace">
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="proposal-tab-list">
          {proposalTabs.map((t) => (
            <TabsTrigger value={t} key={t}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <output className="sales-notice">{notice}</output>}
        {!active && (
          <p className="capability-note">
            This record is {e.lifecycle?.toLowerCase()}. Restore it before
            editing.
          </p>
        )}
        <TabsContent value="Overview">
          <div className="proposal-callout">
            <div>
              <h3>
                {e.status === 'proposal'
                  ? e.lifecycle === 'Deleted'
                    ? 'Deleted proposal'
                    : 'Proposal ready to share'
                  : 'Booking confirmed'}
              </h3>
              <p>
                {e.status === 'proposal'
                  ? e.lifecycle === 'Deleted'
                    ? 'Client link disabled · restore to make this proposal available again'
                    : 'Awaiting acceptance · date remains open'
                  : 'View your booking and client details.'}
              </p>
            </div>
            <div className="proposal-actions">
              <button
                className="primary"
                disabled={blocked || !active}
                onClick={() => void emailDraft()}
              >
                <Mail size={16} />
                Send Email
              </button>
              <button
                className="secondary"
                disabled={blocked || !active}
                onClick={() => void share(true)}
              >
                <Copy size={16} />
                Copy Link
              </button>
              <a
                className="secondary"
                href={'/proposal/' + e.id}
                target="_blank"
                rel="noreferrer"
              >
                <Eye size={16} />
                Preview
              </a>
            </div>
          </div>
          <p className="muted">
            Send Email opens a draft for review. Email delivery is not
            connected.
          </p>
          {link && (
            <div className="proposal-card">
              <label>
                Client proposal link
                <input
                  className="proposal-link-field"
                  readOnly
                  value={link}
                  onFocus={(v) => v.target.select()}
                />
              </label>
              <small>
                Anyone with this link and access to your site can view the
                proposal and customer-visible attachments.
              </small>
            </div>
          )}
          <div className="proposal-columns">
            <div>
              <section className="proposal-card">
                <div className="proposal-actions">
                  <h3>Packages & event</h3>
                  <button
                    className="text-button"
                    disabled={blocked || !active}
                    onClick={onEdit}
                  >
                    Edit details
                  </button>
                </div>
                <p>
                  <strong>{prettyDate(e.date)}</strong>
                  {e.time ? ' · ' + e.time : ''}
                </p>
                {e.items.map((p) => {
                  const pkg = data.packages.find((x) => x.id === p.id),
                    image =
                      pkg?.images?.find((i) => i.is_primary) ||
                      pkg?.images?.[0];
                  return (
                    <div className="package-overview" key={p.id}>
                      {image && (
                        <Image
                          unoptimized
                          width={100}
                          height={110}
                          src={
                            '/api/package-images?id=' +
                            encodeURIComponent(image.id)
                          }
                          alt={p.name}
                        />
                      )}
                      <div>
                        <h4>{p.name}</h4>
                        <p>
                          {p.service} · {p.duration}
                        </p>
                        {pkg?.description && (
                          <p className="proposal-preserve">{pkg.description}</p>
                        )}
                        <strong>{money(p.price)}</strong>
                      </div>
                    </div>
                  );
                })}
                <QuoteBreakdown quote={ops.quote} />
                <button
                  className="secondary"
                  disabled={blocked || !active}
                  onClick={onEdit}
                >
                  Edit packages & add-ons
                </button>
              </section>
              <section className="proposal-card">
                <h3>Venue</h3>
                <p>{e.venue || 'Venue to be confirmed'}</p>
                <button
                  className="text-button"
                  onClick={onEdit}
                  disabled={blocked || !active}
                >
                  Edit venue
                </button>
              </section>
              <section className="proposal-card">
                <h3>Private notes</h3>
                <p className="proposal-preserve">
                  {e.notes || 'No private notes.'}
                </p>
              </section>
              <ClientSubmission item={e} />
            </div>
            <aside>
              <section className="proposal-card">
                <h3>Client</h3>
                <p>
                  <strong>{e.client}</strong>
                </p>
                <p>{e.email}</p>
                <p>{e.phone}</p>
              </section>
              <section className="proposal-card">
                <h3>Payments & balance</h3>
                <dl className="proposal-metrics">
                  <div>
                    <dt>Total</dt>
                    <dd>{money(e.total)}</dd>
                  </div>
                  <div>
                    <dt>Collected</dt>
                    <dd>{money(summary.paid)}</dd>
                  </div>
                  <div>
                    <dt>Retainer / deposit</dt>
                    <dd>{money(e.deposit)}</dd>
                  </div>
                  <div>
                    <dt>Balance</dt>
                    <dd>{money(Math.max(0, e.total - summary.paid))}</dd>
                  </div>
                </dl>
                <p>Due {prettyDate(summary.invoice.dueOn)}</p>
                <button className="secondary" onClick={() => setTab('Invoice')}>
                  View invoice
                </button>
                <button
                  className="text-button"
                  onClick={onEdit}
                  disabled={blocked || !active}
                >
                  Edit retainer amount
                </button>
              </section>
              {e.status === 'proposal' && (
                <section className="proposal-card">
                  <h3>Client options</h3>
                  <label className="proposal-client-option" htmlFor="proposal-show-discount">
                    <Switch
                      id="proposal-show-discount"
                      checked={ops.showDiscountCode === true}
                      disabled={blocked || !active}
                      onCheckedChange={(showDiscountCode) => void run({
                        action: 'save_discount_visibility',
                        eventId: e.id,
                        showDiscountCode,
                        previous: ops.showDiscountCode === true,
                      }, '/api/proposal')}
                    />
                    <span>Show discount code field</span>
                  </label>
                  <p className="muted">
                    Let this client enter or change a code. Any discount already applied stays in the total.
                  </p>
                </section>
              )}
              <section className="proposal-card">
                <h3>Tools</h3>
                <p>Created {prettyDate(e.created_at.slice(0, 10))}</p>
                <p>
                  Next follow-up:{' '}
                  {e.follow_up ? prettyDate(e.follow_up) : 'Not set'}
                </p>
                <p>Source: {ops.sales?.origin || e.source || 'Manual'}</p>
                {e.status === 'proposal' && (
                  <button
                    className="primary"
                    disabled={blocked || !active}
                    onClick={onConfirm}
                  >
                    Confirm booking <ArrowRight size={16} />
                  </button>
                )}
                {e.status === 'confirmed' && (
                  <button
                    className="secondary"
                    disabled={blocked || !active}
                    onClick={onReopen}
                  >
                    Reopen for changes
                  </button>
                )}
                <p className="muted">
                  Confirm after arranging acceptance with your client.
                </p>
                <button
                  className="text-button"
                  disabled={blocked}
                  onClick={() => setRevoke(true)}
                >
                  Disable client link
                </button>
                {e.status === 'proposal' && e.lifecycle !== 'Deleted' && (
                  <button
                    className="secondary proposal-delete"
                    disabled={blocked}
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={16} /> Delete proposal
                  </button>
                )}
                {e.status === 'proposal' && e.lifecycle === 'Deleted' && (
                  <button
                    className="secondary"
                    disabled={blocked}
                    onClick={() =>
                      void run({
                        action: 'event_lifecycle',
                        ids: [e.id],
                        lifecycle: 'Active',
                      })
                    }
                  >
                    Restore proposal
                  </button>
                )}
              </section>
              <section className="proposal-card">
                <h3>Staff</h3>
                <EventPlanning
                  item={e}
                  data={data}
                  onSave={onSave}
                  busy={blocked || !active}
                  section="staff"
                />
              </section>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="Checklists">
          <h3>Event checklists</h3>
          <ChecklistActions event={e} busy={blocked || !active} run={run} />
          <EventPlanning
            key={e.id + 'checklists'}
            item={e}
            data={data}
            onSave={onSave}
            busy={blocked || !active}
            section="checklists"
          />
        </TabsContent>
        <TabsContent value="Designs">
          <div className="proposal-actions">
            <button
              className="secondary"
              disabled={blocked || !active}
              onClick={() =>
                void run(
                  { action: 'add_designs', eventId: e.id },
                  '/api/proposal',
                )
              }
            >
              Add matching design collections
            </button>
          </div>
          <EventPlanning
            key={e.id + 'designs'}
            item={e}
            data={data}
            onSave={onSave}
            busy={blocked || !active}
            section="designs"
          />
        </TabsContent>
        <TabsContent value="Questionnaires">
          <h3>Questionnaires</h3>
          {!ops.questions?.length && (
            <p className="proposal-empty">
              Choose a questionnaire template to add questions to this proposal.
            </p>
          )}
          <EventPlanning
            key={e.id + 'questionnaires'}
            item={e}
            data={data}
            onSave={onSave}
            busy={blocked || !active}
            section="questionnaires"
          />
        </TabsContent>
        <TabsContent value="Make Payment">
          <p className="capability-note">
            Online processing is not connected. Record payments received
            elsewhere below.
          </p>
          <EventPlanning
            item={e}
            data={data}
            onSave={onSave}
            busy={blocked || !active}
            section="payments"
          />
        </TabsContent>
        <TabsContent value="Invoice">
          <div className="proposal-actions">
            <button className="primary" onClick={() => setTab('Make Payment')}>
              Make Payment
            </button>
            <a
              className="secondary"
              href={'/proposal/' + e.id + '?view=invoice'}
              target="_blank"
              rel="noreferrer"
            >
              <Printer size={16} />
              Preview / Save PDF
            </a>
            <button
              className="secondary"
              disabled={blocked || !active}
              onClick={() => {
                setInvoice(invoiceDetails(e));
                setInvoiceEdit(true);
              }}
            >
              Edit invoice details
            </button>
            <button
              className="text-button"
              disabled={blocked || !active}
              onClick={onEdit}
            >
              Edit line items
            </button>
          </div>
          {invoiceEdit && (
            <form
              className="proposal-card form-stack"
              onSubmit={async (ev) => {
                ev.preventDefault();
                if (
                  await run(
                    {
                      action: 'save_invoice',
                      eventId: e.id,
                      invoice,
                      previous: e.operations?.invoice || null,
                    },
                    '/api/proposal',
                  )
                )
                  setInvoiceEdit(false);
              }}
            >
              <div className="form-grid">
                {(
                  [
                    ['number', 'Invoice number', 'text'],
                    ['poNumber', 'PO number', 'text'],
                    ['issuedOn', 'Invoice date', 'date'],
                    ['dueOn', 'Payment due date', 'date'],
                    ['recipient', 'Invoice recipient', 'text'],
                    ['email', 'Recipient email', 'email'],
                  ] as const
                ).map(([k, label, type]) => (
                  <SField
                    key={k}
                    label={label}
                    value={invoice[k]}
                    type={type}
                    onChange={(v) => setInvoice({ ...invoice, [k]: v })}
                  />
                ))}
              </div>
              <SField
                label="Public invoice notes"
                value={invoice.notes}
                type="textarea"
                onChange={(notes) => setInvoice({ ...invoice, notes })}
              />
              <button className="primary" disabled={blocked}>
                Save invoice details
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setInvoiceEdit(false)}
              >
                Cancel
              </button>
            </form>
          )}
          <ProposalDocument summary={summary} business={business} invoice />
        </TabsContent>
        <TabsContent value="Attachments">
          <EventAttachments key={e.id} eventId={e.id} readOnly={!active} />
        </TabsContent>
        <TabsContent value="Messages">
          <Messages {...messageProps} />
          {editor && (
            <section className="proposal-message-editor">
              <h3>{editor.title || 'Message draft'}</h3>
              <SalesEditor
                key={JSON.stringify(editor)}
                {...messageProps}
                editor={editor}
                onClose={() => setEditor(null)}
              />
            </section>
          )}
        </TabsContent>
      </Tabs>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              “{e.title}” will move to Deleted and its client link will be
              unavailable while deleted. Payments and attachments are kept. You
              can restore it from Proposals → Deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep proposal</AlertDialogCancel>
            <AlertDialogAction
              disabled={blocked}
              onClick={async () => {
                if (
                  await run({
                    action: 'event_lifecycle',
                    ids: [e.id],
                    lifecycle: 'Deleted',
                  })
                )
                  setDeleting(false);
              }}
            >
              Delete proposal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={revoke} onOpenChange={setRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable the client link?</AlertDialogTitle>
            <AlertDialogDescription>
              Previously copied links will stop working. Copy Link will create a
              new link next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setWorking(true);
                try {
                  const r = await fetch('/api/proposal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'revoke_link',
                      eventId: e.id,
                    }),
                  });
                  if (!r.ok) throw Error('Unable to disable link.');
                  setLink('');
                  setNotice('Client link disabled.');
                } catch (err) {
                  setError(String(err));
                } finally {
                  setWorking(false);
                }
              }}
            >
              Disable link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function ChecklistActions({
  event: e,
  busy,
  run,
}: {
  event: EventRecord;
  busy: boolean;
  run: SalesProps['run'];
}) {
  const [add, setAdd] = useState(false),
    [label, setLabel] = useState(''),
    [due, setDue] = useState(''),
    [reset, setReset] = useState(false);
  return (
    <>
      <div className="proposal-actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setAdd(true)}
        >
          Add checklist task
        </button>
        <button
          className="text-button"
          disabled={busy || !e.operations?.tasks?.length}
          onClick={() => setReset(true)}
        >
          Reset checklists
        </button>
      </div>
      {add && (
        <form
          className="proposal-card form-stack"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (
              await run(
                {
                  action: 'add_checklist_task',
                  eventId: e.id,
                  label,
                  due,
                  previous: e.operations?.tasks || [],
                },
                '/api/proposal',
              )
            ) {
              setAdd(false);
              setLabel('');
              setDue('');
            }
          }}
        >
          <SField
            label="Task"
            value={label}
            onChange={setLabel}
            required
            max={200}
          />
          <SField
            label="Due date (optional)"
            value={due}
            onChange={setDue}
            type="date"
          />
          <button className="primary" disabled={busy}>
            Add task
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setAdd(false)}
          >
            Cancel
          </button>
        </form>
      )}
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset checklist completion?</AlertDialogTitle>
            <AlertDialogDescription>
              All checklist items will be unchecked. Tasks, dates and notes will
              remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() =>
                void run(
                  {
                    action: 'reset_checklist',
                    eventId: e.id,
                    previous: e.operations?.tasks || [],
                  },
                  '/api/proposal',
                )
              }
            >
              Reset checklists
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
