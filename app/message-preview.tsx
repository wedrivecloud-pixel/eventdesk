'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SChoice, SField } from './sales-ui';
import { MSection } from './manage-editors';
import {
  normalizedMessage,
  rolesFor,
  timingLabel,
} from '@/lib/message-catalog';
import {
  messageContexts,
  contextId,
  contextTitle,
  messageValues,
  renderMessage,
  messageRecipients,
  messageSchedule,
  messageIssues,
  conditionResults,
  localInstant,
} from '@/lib/message-preview';
import { details } from '@/lib/manage-config';
import type { Resource } from '@/lib/settings';
import type { Data } from '@/lib/crm';
export function MessagePreview({
  resource,
  data,
  onData,
  onClose,
  onNavigate,
}: {
  resource: Resource;
  data: Data;
  onData: (data: Data) => void;
  onClose: () => void;
  onNavigate: (s: string) => void;
}) {
  const r = normalizedMessage(resource),
    contexts = messageContexts(r, data);
  const [selected, setSelected] = useState(''),
    [fill, setFill] = useState<Record<string, string>>({}),
    [occurred, setOccurred] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [previewAddress, setPreviewAddress] = useState(''),
    [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const context = contexts.find((c) => contextId(c) === selected) || {},
    recipients = messageRecipients(r, context, data),
    baseValues = messageValues(
      context,
      data,
      recipients.find((r) => r.address === previewAddress) || recipients[0],
      typeof window === 'undefined' ? '' : window.location.origin,
    ),
    values = { ...fill, ...baseValues };
  const subject = renderMessage(String(r.data.subject || ''), values),
    body = renderMessage(String(r.data.body || ''), values),
    missing = [
      ...new Set([
        ...renderMessage(String(r.data.subject || ''), baseValues).unresolved,
        ...renderMessage(String(r.data.body || ''), baseValues).unresolved,
      ]),
    ];
  const tz = String(data.settings?.timezone || 'America/Los_Angeles'),
    occurredAt = occurred
      ? localInstant(
          occurred.slice(0, 10),
          occurred.slice(11, 16),
          tz,
        )?.toISOString() || ''
      : '';
  const schedule = messageSchedule(r, context, data, occurredAt),
    originalSchedule = messageSchedule(r, context, data),
    issues = messageIssues(r, context, data);
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      if (occurred && !occurredAt)
        throw Error(
          'This trigger time is not valid in the business time zone.',
        );
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare_message_drafts',
          templateId: r.id,
          systemKey:
            r.kind === 'system_templates' ? r.data.systemKey : undefined,
          contextId: selected,
          values: fill,
          occurredAt,
          requestId,
        }),
      });
      const j = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(j.error);
      onData(j);
      setNotice(
        'Drafts saved in Sales → Messages → Awaiting Review. Nothing was sent.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare drafts.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="crm-dialog message-preview-dialog">
        <DialogHeader>
          <DialogTitle>Preview: {r.name}</DialogTitle>
          <DialogDescription>
            Review the template with your records, then prepare drafts. Delivery
            is off.
          </DialogDescription>
        </DialogHeader>
        <div className="message-preview-layout">
          <MSection title="Template">
            <dl className="message-metadata">
              <dt>Type</dt>
              <dd>{String(r.data.channel)}</dd>
              {r.kind === 'automations' && (
                <>
                  <dt>Trigger</dt>
                  <dd>{String(r.data.eventTrigger)}</dd>
                  <dt>Timing</dt>
                  <dd>{timingLabel(r)}</dd>
                </>
              )}
              <dt>Recipients</dt>
              <dd>
                {rolesFor(r.data).join(', ')}{' '}
                {String(r.data.extraRecipients || '')}
              </dd>
              <dt>Replies to</dt>
              <dd>{String(r.data.customReplyTo || r.data.replyTo)}</dd>
              <dt>Tags</dt>
              <dd>{String(r.data.tags || 'None')}</dd>
            </dl>
            <p className="capability-note">Draft and review only</p>
          </MSection>
          <MSection title="Live Preview">
            <SChoice
              label="Preview with record"
              value={selected}
              onChange={(id) => {
                setSelected(id);
                setPreviewAddress('');
                setRequestId(crypto.randomUUID());
                setFill({});
                setOccurred('');
                setError('');
                setNotice('');
              }}
              options={[
                { value: '', label: 'Choose a matching record' },
                ...contexts.map((c) => ({
                  value: contextId(c),
                  label: contextTitle(c),
                })),
              ]}
            />
            {!contexts.length && (
              <p>
                No matching records yet. Create a booking, proposal, lead or
                appointment in the relevant Sales section.
              </p>
            )}
            {!selected && (
              <div className="message-preview-content">
                <h3>{String(r.data.subject || r.name)}</h3>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {String(r.data.body || '')}
                </p>
                <p className="muted">
                  Choose a record above to fill in the dynamic values.
                </p>
              </div>
            )}
            {selected && (
              <>
                {recipients.length > 1 && (
                  <SChoice
                    label="Preview recipient"
                    value={previewAddress || recipients[0].address}
                    onChange={setPreviewAddress}
                    options={recipients.map((r) => ({
                      value: r.address,
                      label: r.name ? `${r.name} · ${r.address}` : r.address,
                    }))}
                  />
                )}
                <div className="message-preview-content">
                  {r.data.channel !== 'SMS' && <h3>{subject.text}</h3>}
                  <p style={{ whiteSpace: 'pre-wrap' }}>{body.text}</p>
                </div>
                <p>
                  <b>Draft recipients:</b>{' '}
                  {recipients.map((r) => r.address).join(', ') ||
                    'No recipient addresses recorded'}
                </p>
                {r.kind === 'automations' && (
                  <>
                    <p>
                      <b>Planned timing:</b> {schedule.label}
                    </p>
                    {!originalSchedule.date && r.data.timing !== 'Manual' && (
                      <SField
                        label={`Actual trigger time (${tz}, optional for draft preview)`}
                        type="datetime-local"
                        value={occurred}
                        onChange={setOccurred}
                      />
                    )}
                  </>
                )}
                {missing.length > 0 && (
                  <MSection title="Fill in missing values">
                    <p>
                      These values are not recorded for this item. Enter real
                      values for this draft; template placeholders stay
                      reusable.
                    </p>
                    {missing.some((key) =>
                      ['event_link', 'proposal_link', 'invoice_link'].includes(
                        key,
                      ),
                    ) && (
                      <p>
                        For an event or invoice link, use Copy Link in the
                        booking or proposal first, then reopen this preview.
                        Existing client links fill automatically.
                      </p>
                    )}
                    {missing.map((key) => (
                      <SField
                        key={key}
                        label={`{{${key}}}`}
                        value={fill[key] || ''}
                        onChange={(v) => setFill({ ...fill, [key]: v })}
                        type={key.endsWith('_link') ? 'url' : 'text'}
                        max={2000}
                      />
                    ))}
                  </MSection>
                )}
                {r.kind === 'automations' &&
                  conditionResults(r, context, data).map((x, i) => (
                    <p key={i} className={x.matches ? 'notice' : 'error'}>
                      {x.matches ? 'Matches' : 'Does not match'}:{' '}
                      {x.condition.field} {x.condition.operator.toLowerCase()}{' '}
                      {x.condition.value} · Current value: {x.actual}
                    </p>
                  ))}
                {issues.map((issue) => (
                  <p className="error" key={issue}>
                    {issue}
                  </p>
                ))}
              </>
            )}
            {details(r).attachments.map((id) => (
              <a
                className="message-attachment"
                key={id}
                href={'/api/media?id=' + id}
                target="_blank"
                rel="noreferrer"
              >
                {data.resources?.find((r) => r.id === id)?.name || 'Attachment'}
              </a>
            ))}
          </MSection>
        </div>
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
        <div className="sales-actions">
          <button
            className="primary"
            disabled={
              busy ||
              !!notice ||
              !selected ||
              !!issues.length ||
              !recipients.length ||
              !!subject.unresolved.length ||
              !!body.unresolved.length
            }
            onClick={() => void prepare()}
          >
            {busy ? 'Preparing…' : 'Create drafts for review'}
          </button>
          <button
            className="secondary"
            onClick={() => {
              onClose();
              onNavigate('Messages');
            }}
          >
            Review messages
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
