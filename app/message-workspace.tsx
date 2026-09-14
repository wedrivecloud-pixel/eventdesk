'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SChoice, SField, STabs, SActions, SToggle } from './sales-ui';
import { MessageEditor } from './message-editor';
import { MessagePreview } from './message-preview';
import type { ManageProps } from './manage-resources';
import {
  triggers,
  messageTabs,
  messageCategories,
  systemTemplates,
  customStarters,
  automationStarters,
  normalizedMessage,
  rolesFor,
  timingLabel,
  triggerCategory,
  newAutomationMessage,
  type MessageStarter,
} from '@/lib/message-catalog';
import { appliesTo, details } from '@/lib/manage-config';
import type { Resource } from '@/lib/settings';
import type { Data } from '@/lib/crm';
export function MessageWorkspace({
  kind,
  data,
  onData,
  onNavigate,
}: { kind: string } & ManageProps) {
  const tab =
      kind === 'automations'
        ? messageTabs[0]
        : kind === 'messages'
          ? messageTabs[1]
          : messageTabs[2],
    system = kind === 'system_templates',
    automated = kind === 'automations';
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('All'),
    [channel, setChannel] = useState('Email & SMS'),
    [pkg, setPkg] = useState('all'),
    [status, setStatus] = useState('Active'),
    [showEmpty, setShowEmpty] = useState(true),
    [mode, setMode] = useState(''),
    [editing, setEditing] = useState<Resource>(),
    [preview, setPreview] = useState<Resource>(),
    [target, setTarget] = useState<Resource>(),
    [action, setAction] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const records = system
    ? systemTemplates.map(
        (t) =>
          data.resources?.find(
            (r) => r.kind === kind && r.data.systemKey === t.key && !r.archived,
          ) ||
          ({
            id: '',
            kind,
            name: t.name,
            data: t.data,
            archived: 0,
          } as Resource),
      )
    : (data.resources || []).filter((r) => r.kind === kind);
  const rows = records
    .map(normalizedMessage)
    .filter(
      (r) =>
        (system ||
          status === 'All' ||
          !!r.archived === (status === 'Archived')) &&
        (channel === 'Email & SMS' || r.data.channel === channel) &&
        (pkg === 'all' || appliesTo(r, pkg === 'one-off' ? [] : [pkg])) &&
        (category === 'All' ||
          (automated
            ? triggerCategory(String(r.data.eventTrigger))
            : r.data.category) === category) &&
        `${r.name} ${r.data.subject} ${r.data.body} ${r.data.tags || ''} ${r.data.eventTrigger}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const edit = (r: Resource) => {
    setError('');
    setEditing(r);
    setMode('');
  };
  const newMessage = (trigger = 'Booked Date', cat = 'Bookings') =>
    edit(
      automated
        ? newAutomationMessage(trigger)
        : {
            id: '',
            kind,
            name: '',
            archived: 0,
            data: {
              eventTrigger: trigger,
              timing: 'When',
              offset: 0,
              timeUnit: 'Days',
              category: cat,
              recipient: 'Client',
              channel: 'Email',
              reviewBeforeSending: true,
              enabled: true,
            },
          },
    );
  async function run(body: Record<string, unknown>, result = 'Changes saved.') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        j = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(j.error);
      onData(j);
      setEditing(undefined);
      setTarget(undefined);
      setNotice(result);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const applyStarter = (t: MessageStarter) =>
    edit({
      id: '',
      kind: t.kind,
      name: t.name,
      data: { ...t.data },
      archived: 0,
    });
  function starterCard(t: MessageStarter) {
    const r = normalizedMessage({
      id: '',
      kind: t.kind,
      name: t.name,
      data: t.data,
      archived: 0,
    });
    return (
      <article className="message-rule" key={t.key}>
        <h3>{t.name}</h3>
        <div className="message-rule-badges">
          <span>Prefilled template</span>
          <span>{String(r.data.channel)}</span>
          {automated && <span>{timingLabel(r)}</span>}
        </div>
        <p>
          <b>Recipients:</b> {rolesFor(r.data).join(', ')}
        </p>
        <p>
          <b>Subject:</b> {String(r.data.subject)}
        </p>
        <details>
          <summary>View Details</summary>
          <p>
            <b>Replies to:</b> {String(r.data.replyTo)}
          </p>
          <p>
            <b>Conditions:</b>{' '}
            {details(r)
              .conditions.map((c) => `${c.field}: ${c.value}`)
              .join(' · ') || 'Always run'}
          </p>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {String(r.data.body)}
          </p>
        </details>
        <button className="secondary" onClick={() => applyStarter(t)}>
          Use Template
        </button>
      </article>
    );
  }
  function card(r: Resource) {
    const actions = [
      { label: 'Preview', action: () => setPreview(r) },
      { label: 'Edit', action: () => edit(r) },
      ...(system
        ? r.id
          ? [
              {
                label: 'Restore default template',
                action: () => {
                  setTarget(r);
                  setAction('reset');
                },
              },
            ]
          : []
        : [
            {
              label: 'Duplicate',
              action: () =>
                edit({
                  ...r,
                  id: '',
                  name: (r.name + ' (copy)').slice(0, 120),
                }),
            },
            ...(automated
              ? [
                  {
                    label:
                      r.data.enabled === false ? 'Resume rule' : 'Pause rule',
                    action: () =>
                      void run({
                        action: 'save_resource',
                        kind: r.kind,
                        id: r.id,
                        name: r.name,
                        data: { ...r.data, enabled: r.data.enabled === false },
                      }),
                  },
                ]
              : []),
            {
              label: r.archived ? 'Restore' : 'Archive',
              action: () =>
                void run({
                  action: 'archive_resource',
                  id: r.id,
                  archived: !r.archived,
                }),
            },
            {
              label: 'Delete',
              action: () => {
                setTarget(r);
                setAction('delete');
              },
            },
          ]),
    ];
    return (
      <article className="message-rule" key={r.id || String(r.data.systemKey)}>
        <div className="message-rule-heading">
          <button className="message-title" onClick={() => setPreview(r)}>
            {r.name}
          </button>
          <SActions label={`Actions for ${r.name}`} items={actions} />
        </div>
        <div className="message-rule-badges">
          <span>{String(r.data.channel)}</span>
          {automated && <span>{timingLabel(r)}</span>}
          <span>
            {system
              ? r.id
                ? 'Customized'
                : 'Eventdeskly default'
              : r.archived
                ? 'Archived'
                : r.data.enabled === false
                  ? 'Paused'
                  : 'Draft & review'}
          </span>
        </div>
        <p>
          <b>Recipients:</b> {rolesFor(r.data).join(', ')}{' '}
          {String(r.data.extraRecipients || '')}
        </p>
        {r.data.channel !== 'SMS' && (
          <p>
            <b>Subject:</b> {String(r.data.subject)}
          </p>
        )}
        {automated && (
          <small>
            {details(r).packageMode === 'all'
              ? 'All packages'
              : details(r).packageMode === 'none'
                ? 'No packages'
                : `${details(r).packageIds.length} selected packages`}
            {details(r).conditions.map((c, i) => (
              <span key={i}>
                {' '}
                · {c.field}: {c.value}
              </span>
            ))}
          </small>
        )}
        {r.data.tags && <small>Tags: {String(r.data.tags)}</small>}
        <details>
          <summary>View Details</summary>
          <p style={{ whiteSpace: 'pre-wrap' }}>{String(r.data.body)}</p>
          <p>
            Replies to: {String(r.data.customReplyTo || r.data.replyTo)} ·{' '}
            {details(r).attachments.length} attachments
          </p>
          <div className="sales-actions">
            <button className="secondary" onClick={() => setPreview(r)}>
              Live Preview
            </button>
            <button className="secondary" onClick={() => edit(r)}>
              Edit template
            </button>
          </div>
        </details>
      </article>
    );
  }
  const library = (automated ? automationStarters : customStarters).filter(
    (t) =>
      (category === 'All' ||
        (t.kind === 'automations'
          ? triggerCategory(String(t.data.eventTrigger))
          : t.data.category) === category) &&
      (channel === 'Email & SMS' || (t.data.channel || 'Email') === channel) &&
      `${t.name} ${t.description} ${t.data.subject || ''} ${t.data.body || ''} ${t.data.eventTrigger || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel manage-workspace message-workspace">
      <div className="panel-heading">
        <div>
          <h2>{tab}</h2>
          <p className="muted">
            {system
              ? 'Customize built-in messages for invitations, proposals, galleries and designs.'
              : automated
                ? 'Organize reminders and follow-ups by the moment that triggers them.'
                : 'Reusable messages for bookings, proposals, leads and appointments.'}
          </p>
        </div>
        <button className="secondary" onClick={() => onNavigate('Messages')}>
          Review messages
        </button>
      </div>
      <p className="capability-note">
        Drafts and review are available. Automatic scheduling and email/SMS
        delivery remain off.
      </p>
      {!system && (
        <div className="sales-actions">
          <button
            className="primary"
            onClick={() => {
              setMode('new');
              setError('');
            }}
          >
            + {automated ? 'New Automated Message' : 'New Template'}
          </button>
          <button
            className="secondary"
            onClick={() => setMode(mode === 'library' ? '' : 'library')}
          >
            {mode === 'library' ? 'Back to messages' : 'Browse Templates'}
          </button>
        </div>
      )}
      <div className="manage-toolbar">
        <SField
          label="Search messages and tags"
          value={query}
          onChange={setQuery}
        />
        <SChoice
          label="Message type"
          value={channel}
          onChange={setChannel}
          options={['Email & SMS', 'Email', 'SMS']}
        />
        <SChoice
          label="Package"
          value={pkg}
          onChange={setPkg}
          options={[
            { value: 'all', label: 'Any package' },
            { value: 'one-off', label: 'Custom or one-off event' },
            ...data.packages.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        {!system && (
          <SChoice
            label="Show messages"
            value={status}
            onChange={setStatus}
            options={['Active', 'Archived', 'All']}
          />
        )}
      </div>
      {!system && (
        <STabs
          value={category}
          tabs={['All', ...messageCategories]}
          onChange={setCategory}
        />
      )}
      {error && !editing && !target && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {mode === 'library' ? (
        <>
          <h3>Browse Templates</h3>
          <p className="muted">
            Eventdeskly starter messages. Review and customize a template before
            saving it.
          </p>
          <div className="message-library">{library.map(starterCard)}</div>
          {!library.length && <p>No starter templates match these filters.</p>}
        </>
      ) : automated ? (
        <>
          <SToggle
            label="Show triggers without messages"
            value={showEmpty}
            onChange={setShowEmpty}
          />
          {triggers
            .filter(
              (t) =>
                (category === 'All' || t.category === category) &&
                (showEmpty ||
                  rows.some((r) => r.data.eventTrigger === t.name)) &&
                (!query ||
                  rows.some((r) => r.data.eventTrigger === t.name) ||
                  library.some((r) => r.data.eventTrigger === t.name) ||
                  t.name.toLowerCase().includes(query.toLowerCase())),
            )
            .map((t) => (
              <section className="message-trigger-group" key={t.name}>
                <header>
                  <div>
                    <h3>{t.name}</h3>
                    <p>{t.description}</p>
                  </div>
                  <button
                    className="secondary"
                    aria-label={'Add message for ' + t.name}
                    onClick={() => newMessage(t.name, t.category)}
                  >
                    + Add message
                  </button>
                </header>
                {rows.filter((r) => r.data.eventTrigger === t.name).map(card)}
                {status !== 'Archived' &&
                  library.some((r) => r.data.eventTrigger === t.name) && (
                    <details
                      open={!rows.some((r) => r.data.eventTrigger === t.name)}
                    >
                      <summary>Prefilled messages for {t.name}</summary>
                      <p className="muted">
                        Ready to customize. Save a copy to add it to your
                        messages. New rules start paused.
                      </p>
                      <div className="message-library">
                        {library
                          .filter((r) => r.data.eventTrigger === t.name)
                          .map(starterCard)}
                      </div>
                    </details>
                  )}
                {!rows.some((r) => r.data.eventTrigger === t.name) && (
                  <p className="message-empty">
                    No saved messages match this trigger and the current
                    filters.
                  </p>
                )}
              </section>
            ))}
        </>
      ) : system ? (
        <div className="message-library">{rows.map(card)}</div>
      ) : (
        messageCategories
          .filter((c) => category === 'All' || category === c)
          .map((c) => (
            <section className="message-trigger-group" key={c}>
              <header>
                <h3>{c} Message Templates</h3>
                <button
                  className="secondary"
                  onClick={() => newMessage('Booked Date', c)}
                >
                  + Add template
                </button>
              </header>
              {rows.filter((r) => r.data.category === c).map(card)}
              {!rows.some((r) => r.data.category === c) && (
                <p className="message-empty">
                  No templates match this category and the current filters.
                </p>
              )}
            </section>
          ))
      )}
      <Dialog open={mode === 'new'} onOpenChange={(v) => !v && setMode('')}>
        <DialogContent className="crm-dialog message-picker-dialog">
          <DialogHeader>
            <DialogTitle>
              {automated
                ? 'When do you want your automated message to be prepared?'
                : 'Choose a custom template category'}
            </DialogTitle>
            <DialogDescription>
              {automated
                ? 'Choose a trigger, then set the timing, conditions and message.'
                : 'Templates are prepared manually from the selected type of record.'}
            </DialogDescription>
          </DialogHeader>
          <STabs
            value={category}
            tabs={['All', ...messageCategories]}
            onChange={setCategory}
          />
          <div className="message-library">
            {automated
              ? triggers
                  .filter((t) => category === 'All' || category === t.category)
                  .map((t) => (
                    <article className="message-rule" key={t.name}>
                      <h3>{t.name}</h3>
                      <p>{t.description}</p>
                      <div className="sales-actions">
                        <button
                          className="primary"
                          onClick={() => newMessage(t.name, t.category)}
                        >
                          Choose {t.name}
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            setMode('library');
                            setQuery(t.name);
                          }}
                        >
                          Pre-built Templates
                        </button>
                      </div>
                    </article>
                  ))
              : messageCategories
                  .filter((c) => category === 'All' || c === category)
                  .map((c) => (
                    <button
                      className="secondary"
                      key={c}
                      onClick={() => newMessage('Booked Date', c)}
                    >
                      {c} Message Template
                    </button>
                  ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => !v && !busy && setEditing(undefined)}
      >
        <DialogContent className="crm-dialog message-editor-dialog">
          <DialogHeader>
            <DialogTitle>
              {editing?.id || editing?.kind === 'system_templates'
                ? 'Edit'
                : 'New'}{' '}
              {editing?.kind === 'automations'
                ? 'Automated Message'
                : editing?.kind === 'system_templates'
                  ? 'System Template'
                  : 'Custom Template'}
            </DialogTitle>
            <DialogDescription>
              Save your message, recipients and settings. Sending stays off.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <MessageEditor
              key={editing.id || editing.name + editing.kind}
              item={editing}
              data={data}
              busy={busy}
              onSubmit={run}
            />
          )}{' '}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!target}
        onOpenChange={(v) => !v && !busy && setTarget(undefined)}
      >
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {action === 'reset'
                ? 'Restore default template'
                : 'Delete message'}
            </DialogTitle>
            <DialogDescription>
              {action === 'reset'
                ? `Replace your edits to ${target?.name} with the Eventdeskly default?`
                : `Delete ${target?.name}? Existing drafts will be kept.`}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(
                action === 'reset'
                  ? {
                      action: 'reset_system_template',
                      systemKey: target?.data.systemKey,
                    }
                  : { action: 'delete_resource', id: target?.id },
              )
            }
          >
            {action === 'reset' ? 'Restore default' : 'Delete message'}
          </button>
        </DialogContent>
      </Dialog>
      {preview && (
        <MessagePreview
          resource={preview}
          data={data}
          onData={onData}
          onClose={() => setPreview(undefined)}
          onNavigate={onNavigate}
        />
      )}
    </section>
  );
}
