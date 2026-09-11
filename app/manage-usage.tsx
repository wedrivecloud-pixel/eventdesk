'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SChoice, SToggle } from './sales-ui';
import { details, appliesTo } from '@/lib/manage-config';
import { money, prettyDate, type Data, type EventRecord } from '@/lib/crm';
import type { Resource } from '@/lib/settings';
import { QuestionnairePreview } from './questionnaire-library';
export function ManageUsage({
  resource: r,
  data,
  onData,
  onClose,
}: {
  resource: Resource;
  data: Data;
  onData: (d: Data) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [sync, setSync] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const template = ['questionnaires', 'checklists', 'contracts'].includes(
      r.kind,
    ),
    message = ['messages', 'automations'].includes(r.kind),
    events = data.events.filter(
      (e) =>
        !['Deleted', 'Spam', 'Archived', 'Canceled'].includes(
          e.lifecycle || 'Active',
        ) &&
        appliesTo(
          r,
          e.items.map((p) => p.id),
        ),
    ),
    event = events.find((e) => e.id === selected[0]),
    d = details(r);
  const render = (text: string) =>
    text.replace(
      /\{\{(client|event|business|date|total)\}\}/g,
      (_, key) =>
        (
          ({
            client: event?.client || 'Client name',
            event: event?.title || 'Event name',
            business: data.business?.name || '',
            date: event ? prettyDate(event.date) : 'Event date',
            total: event ? money(event.total) : '$0.00',
          }) as Record<string, string>
        )[key],
    );
  const conditionValues: Record<string, string> = event
    ? {
        Balance: String(
          (event.total -
            (data.payments || [])
              .filter((p) => p.event_id === event.id)
              .reduce((s, p) => s + p.amount, 0)) /
            100,
        ),
        Deposit: String(event.deposit / 100),
        Tips: String(
          (data.payments || [])
            .filter((p) => p.event_id === event.id)
            .reduce((s, p) => s + (p.tip || 0), 0) / 100,
        ),
        Staff: event.operations?.staffIds?.length ? 'Yes' : 'No',
        Backdrop: event.operations?.quote?.backdropId ? 'Yes' : 'No',
        Designs: event.operations?.designId ? 'Yes' : 'No',
        Contract: event.operations?.contract ? 'Yes' : 'No',
        Questionnaires: event.operations?.questionsFinalized
          ? 'Complete'
          : 'Incomplete',
        'Day of week': new Date(event.date + 'T12:00:00Z').toLocaleDateString(
          'en-US',
          { weekday: 'long', timeZone: 'UTC' },
        ),
      }
    : {};
  const matches =
    !event ||
    d.conditions.every((c) =>
      c.operator === 'Is not'
        ? conditionValues[c.field] !== c.value
        : conditionValues[c.field] === c.value,
    );
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (template) {
        const res = await fetch('/api/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'apply_templates',
              templateId: r.id,
              eventIds: selected,
              sync,
            }),
          }),
          j = (await res.json()) as Data & { error?: string };
        if (!res.ok) throw Error(j.error);
        onData(j);
        setNotice('Template applied to ' + selected.length + ' events.');
      } else if (message && event) {
        const recipients = String(r.data.recipient || 'Client'),
          staff = (data.resources || []).filter((s) =>
            event.operations?.staffIds?.includes(s.id),
          );
        const addresses = [
          ...(recipients.includes('Client') ? [event.email] : []),
          ...(recipients.includes('business') || recipients === 'My business'
            ? [data.business?.email || '']
            : []),
          ...(recipients.toLowerCase().includes('staff')
            ? staff.map((s) => String(s.data.email || ''))
            : []),
        ].filter(Boolean);
        if (!addresses.length)
          throw Error(
            'Add a recipient email address to the selected event or business.',
          );
        for (const recipient of [...new Set(addresses)]) {
          const res = await fetch('/api/sales', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'save_record',
                kind: 'message',
                data: {
                  eventId: event.id,
                  channel: 'Email',
                  recipient,
                  subject: render(String(r.data.subject || r.name)),
                  body: render(String(r.data.body || '')),
                  state: 'Awaiting Review',
                  notes: `Prepared from ${r.name}. ${r.kind === 'automations' ? `${r.data.offset} ${r.data.timeUnit} ${r.data.timing} ${r.data.eventTrigger}.` : ''} Reply to: ${r.data.replyTo || 'My business'}.`,
                  templateId: r.id,
                  attachments: d.attachments,
                },
              }),
            }),
            j = (await res.json()) as Data & { error?: string };
          if (!res.ok) throw Error(j.error);
          onData(j);
        }
        setNotice('Drafts are in Sales → Messages → Awaiting Review.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="crm-dialog manage-editor-dialog">
        <DialogHeader>
          <DialogTitle>{r.name}</DialogTitle>
          <DialogDescription>
            {template
              ? 'Apply to existing events or synchronize this template. Answers and completed items are preserved when synchronizing.'
              : message
                ? 'Preview a message and prepare drafts for review. No message is sent.'
                : 'Preview the saved record.'}
          </DialogDescription>
        </DialogHeader>
        {template ? (
          <>
            <SToggle
              label="Synchronize previously applied copies"
              value={sync}
              onChange={setSync}
            />
            {events.map((e) => (
              <SToggle
                key={e.id}
                label={e.title + ' · ' + prettyDate(e.date)}
                value={selected.includes(e.id)}
                onChange={(v) =>
                  setSelected(
                    v
                      ? [...selected, e.id]
                      : selected.filter((id) => id !== e.id),
                  )
                }
              />
            ))}
          </>
        ) : message ? (
          <>
            <SChoice
              label="Preview with event"
              value={selected[0] || ''}
              options={[
                { value: '', label: 'Choose event' },
                ...events.map((e) => ({ value: e.id, label: e.title })),
              ]}
              onChange={(id) => setSelected(id ? [id] : [])}
            />
            <h3>{render(String(r.data.subject || ''))}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {render(String(r.data.body || ''))}
            </p>
            {d.attachments.map((id) => (
              <a
                key={id}
                href={'/api/media?id=' + id}
                target="_blank"
                rel="noreferrer"
              >
                {data.resources?.find((r) => r.id === id)?.name || 'Attachment'}
              </a>
            ))}
            {!matches && (
              <p className="error">
                This event does not match the automation conditions.
              </p>
            )}
          </>
        ) : null}
        {r.kind === 'questionnaires' && (
          <details>
            <summary>Preview questions</summary>
            <QuestionnairePreview fields={d.fields} tabs={d.tabs} />
          </details>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        {(template || message) && (
          <button
            type="button"
            className="primary"
            disabled={
              busy || !selected.length || !matches || selected.length > 50
            }
            onClick={() => void save()}
          >
            {busy
              ? 'Saving…'
              : template
                ? 'Apply to selected events'
                : 'Create drafts for review'}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
