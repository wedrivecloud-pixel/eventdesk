'use client';
import { useState } from 'react';
import { SChoice, SField, SToggle, STabs } from './sales-ui';
import { MSection, ScopeEditor, MediaPicker } from './manage-editors';
import { details } from '@/lib/manage-config';
import {
  normalizedMessage,
  triggers,
  messageCategories,
  recipientRoles,
  rolesFor,
  messageTokens,
  conditionOptions,
  automationStarters,
} from '@/lib/message-catalog';
import type { Resource, Settings } from '@/lib/settings';
import type { Data } from '@/lib/crm';

export function MessageEditor({
  item,
  data,
  busy,
  onSubmit,
}: {
  item: Resource;
  data: Data;
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const initial = normalizedMessage(item),
    [name, setName] = useState(item.name),
    [value, setValue] = useState<Settings>(initial.data),
    [advanced, setAdvanced] = useState(() => details(item)),
    [tab, setTab] = useState('Message'),
    [tokenQuery, setTokenQuery] = useState(''),
    [starterKey, setStarterKey] = useState(''),
    [tokenTarget, setTokenTarget] = useState('Message');
  const automation = item.kind === 'automations',
    system = item.kind === 'system_templates',
    trigger = triggers.find((t) => t.name === value.eventTrigger),
    roles = rolesFor(value);
  const change = (key: string, v: string | number | boolean) =>
    setValue({ ...value, [key]: v });
  const tokenList = [
    ...new Set(
      [
        ...messageTokens,
        ...String(value.body || '').matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g),
      ].map((x) => (typeof x === 'string' ? x : x[1])),
    ),
  ].filter((t) => t.includes(tokenQuery.toLowerCase()));
  return (
    <form
      noValidate
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          action: system ? 'save_system_template' : 'save_resource',
          kind: item.kind,
          id: item.id || undefined,
          systemKey: value.systemKey,
          name,
          data: { ...value, details: JSON.stringify(advanced) },
        });
      }}
    >
      <STabs
        tabs={[
          'Message',
          ...(automation ? ['Timing & conditions'] : []),
          'Attachments',
          'Customize your message',
        ]}
        value={tab}
        onChange={setTab}
      />
      <div hidden={tab !== 'Message'}>
        {automation && (
          <MSection title="Prefilled messages">
            <p>
              Choose a starter to replace the subject and message. Your
              recipients, timing and conditions stay as configured.
            </p>
            <SChoice
              label="Prefill from a template"
              value={starterKey}
              onChange={setStarterKey}
              options={[
                { value: '', label: 'Choose a message' },
                ...automationStarters
                  .filter((t) => t.data.eventTrigger === value.eventTrigger)
                  .map((t) => ({ value: t.key, label: t.name })),
              ]}
            />
            <button
              type="button"
              className="secondary"
              disabled={
                !automationStarters.some(
                  (t) =>
                    t.key === starterKey &&
                    t.data.eventTrigger === value.eventTrigger,
                )
              }
              onClick={() => {
                const t = automationStarters.find(
                  (t) =>
                    t.key === starterKey &&
                    t.data.eventTrigger === value.eventTrigger,
                );
                if (t) {
                  setValue({
                    ...value,
                    subject: t.data.subject,
                    body: t.data.body,
                  });
                  if (!name.trim()) setName(t.name);
                  setStarterKey('');
                }
              }}
            >
              Replace subject and message
            </button>
          </MSection>
        )}
        <MSection title={system ? 'System template' : 'About this message'}>
          {system ? (
            <p>
              <b>{name}</b> · {String(value.channel)}
              <br />
              <small>
                Built-in purpose and message type are fixed. Your edits apply
                only to your business.
              </small>
            </p>
          ) : (
            <SField
              label="Description"
              value={name}
              onChange={setName}
              required
              max={120}
            />
          )}
          {!system && (
            <div className="form-grid">
              {!automation && (
                <SChoice
                  label="Template category"
                  value={value.category}
                  onChange={(v) => change('category', v)}
                  options={messageCategories}
                />
              )}
              <SChoice
                label="What to do"
                value={value.channel}
                onChange={(v) => change('channel', v)}
                options={[
                  { value: 'Email', label: 'Prepare email draft' },
                  { value: 'SMS', label: 'Prepare SMS draft' },
                ]}
              />
            </div>
          )}
        </MSection>
        <MSection title="Message">
          <div
            className="message-recipient-options"
            role="group"
            aria-label="Recipients"
          >
            <b>Recipients</b>
            {recipientRoles.map((role) => (
              <SToggle
                key={role}
                label={role}
                value={roles.includes(role)}
                onChange={(yes) =>
                  change(
                    'recipientRoles',
                    (yes
                      ? [...roles, role]
                      : roles.filter((r) => r !== role)
                    ).join('|') || 'None',
                  )
                }
              />
            ))}
          </div>
          <SField
            label={
              value.channel === 'SMS'
                ? 'Additional phone numbers (comma separated)'
                : 'Additional email recipients (comma separated)'
            }
            value={value.extraRecipients}
            onChange={(v) => change('extraRecipients', v)}
            max={500}
          />
          <div className="form-grid">
            <SChoice
              label="Send replies to"
              value={value.replyTo}
              onChange={(v) => change('replyTo', v)}
              options={['My business', 'Assigned staff']}
            />
            <SField
              label="Custom reply email (optional)"
              type="email"
              value={value.customReplyTo}
              onChange={(v) => change('customReplyTo', v)}
              max={254}
            />
          </div>
          {value.channel !== 'SMS' && (
            <SField
              label="Subject"
              value={value.subject}
              onChange={(v) => change('subject', v)}
              required
              max={250}
            />
          )}
          <SField
            label="Message"
            type="textarea"
            value={value.body}
            onChange={(v) => change('body', v)}
            required
            max={10000}
          />
          <small>
            {String(value.body || '').length.toLocaleString()} / 10,000
            characters. Use Customize your message to insert dynamic values.
          </small>
          <SField
            label="Tags (comma separated)"
            value={value.tags}
            onChange={(v) => change('tags', v)}
            max={500}
          />
        </MSection>
      </div>
      {automation && (
        <div hidden={tab !== 'Timing & conditions'}>
          <MSection title="When should this message be prepared?">
            <SChoice
              label="Event trigger"
              value={value.eventTrigger}
              options={triggers.map((t) => t.name)}
              onChange={(v) =>
                setValue({
                  ...value,
                  eventTrigger: v,
                  timing: 'When',
                  offset: 0,
                })
              }
            />
            <p className="muted">{trigger?.description}</p>
            <div className="form-grid">
              <SChoice
                label="Timing"
                value={value.timing}
                onChange={(v) =>
                  setValue({
                    ...value,
                    timing: v,
                    offset: ['Before', 'After'].includes(v)
                      ? Math.max(1, Number(value.offset))
                      : 0,
                  })
                }
                options={[
                  'When',
                  ...(trigger?.before ? ['Before'] : []),
                  'After',
                  'Manual',
                ]}
              />
              {['Before', 'After'].includes(String(value.timing)) && (
                <>
                  <label className="field">
                    <span>Timing amount *</span>
                    <input
                      aria-label="Timing amount"
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      value={Number(value.offset)}
                      onChange={(e) => change('offset', Number(e.target.value))}
                      required
                    />
                  </label>
                  <SChoice
                    label="Timing unit"
                    value={value.timeUnit}
                    onChange={(v) => change('timeUnit', v)}
                    options={[
                      'Minutes',
                      'Hours',
                      'Days',
                      'Weeks',
                      'Months',
                      'Years',
                    ]}
                  />
                </>
              )}
            </div>
            <SToggle
              label="Rule enabled for draft preparation"
              value={value.enabled !== false}
              onChange={(v) => change('enabled', v)}
            />
          </MSection>
          <ScopeEditor
            title="Conditions · applies to packages"
            data={data}
            value={advanced}
            onChange={setAdvanced}
          />
          <MSection title="Additional conditions">
            <p className="muted">
              All conditions must match. Activity details that have not been
              recorded will not count as a match.
            </p>
            {advanced.conditions.map((c, i) => {
              const choices =
                c.field === 'Excluded Package'
                  ? data.packages.map((p) => ({ value: p.id, label: p.name }))
                  : c.field === 'Add-on'
                    ? (data.resources || [])
                        .filter((r) => r.kind === 'addons' && !r.archived)
                        .map((r) => ({ value: r.id, label: r.name }))
                    : conditionOptions[c.field] || [];
              const update = (patch: Partial<typeof c>) =>
                setAdvanced({
                  ...advanced,
                  conditions: advanced.conditions.map((x, j) =>
                    j === i ? { ...x, ...patch } : x,
                  ),
                });
              return (
                <div className="message-condition-row" key={i}>
                  <SChoice
                    label={`Condition ${i + 1}`}
                    value={c.field}
                    options={Object.keys(conditionOptions)}
                    onChange={(field) =>
                      update({
                        field,
                        value: conditionOptions[field]?.[0] || '',
                      })
                    }
                  />
                  <SChoice
                    label={`Match ${i + 1}`}
                    value={c.operator}
                    options={['Is', 'Is not']}
                    onChange={(operator) => update({ operator })}
                  />
                  {choices.length ? (
                    <SChoice
                      label={`Value ${i + 1}`}
                      value={c.value}
                      options={[
                        ...choices,
                        ...(choices.some(
                          (x) =>
                            (typeof x === 'string' ? x : x.value) === c.value,
                        )
                          ? []
                          : [
                              {
                                value: c.value,
                                label: c.value || 'Choose value',
                              },
                            ]),
                      ]}
                      onChange={(value) => update({ value })}
                    />
                  ) : (
                    <SField
                      label={`Value ${i + 1}`}
                      value={c.value}
                      onChange={(value) => update({ value })}
                      required
                      max={500}
                    />
                  )}
                  <button
                    className="secondary"
                    type="button"
                    onClick={() =>
                      setAdvanced({
                        ...advanced,
                        conditions: advanced.conditions.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    Remove condition {i + 1}
                  </button>
                </div>
              );
            })}
            <button
              className="secondary"
              type="button"
              disabled={advanced.conditions.length >= 30}
              onClick={() =>
                setAdvanced({
                  ...advanced,
                  conditions: [
                    ...advanced.conditions,
                    {
                      field: 'Balance',
                      operator: 'Is',
                      value: 'Not fully paid',
                    },
                  ],
                })
              }
            >
              Add condition
            </button>
          </MSection>
          <MSection title="Review Messages">
            <SToggle
              label="Review these messages before sending once delivery is connected"
              value={value.reviewBeforeSending !== false}
              onChange={(v) => change('reviewBeforeSending', v)}
            />
            <p className="capability-note">
              All messages currently go to Sales → Messages → Awaiting Review.
              Delivery is off regardless of this future preference.
            </p>
          </MSection>
        </div>
      )}
      <div hidden={tab !== 'Attachments'}>
        <MSection title="Attachments">
          <MediaPicker
            data={data}
            ids={advanced.attachments}
            onChange={(attachments) =>
              setAdvanced({ ...advanced, attachments })
            }
            documents
          />
        </MSection>
        {!automation && (
          <ScopeEditor data={data} value={advanced} onChange={setAdvanced} />
        )}
      </div>
      <div hidden={tab !== 'Customize your message'}>
        <MSection title="Customize your message">
          <p>
            Insert values from a booking, proposal, lead or appointment. Preview
            shows anything that still needs to be filled in.
          </p>
          <div className="form-grid">
            <SField
              label="Find a dynamic value"
              value={tokenQuery}
              onChange={setTokenQuery}
            />
            <SChoice
              label="Insert into"
              value={tokenTarget}
              onChange={setTokenTarget}
              options={
                value.channel === 'SMS' ? ['Message'] : ['Message', 'Subject']
              }
            />
          </div>
          <div className="message-token-list">
            {tokenList.map((token) => (
              <button
                type="button"
                className="secondary"
                key={token}
                onClick={() => {
                  const key = tokenTarget === 'Subject' ? 'subject' : 'body';
                  change(key, String(value[key] || '') + ` {{${token}}}`);
                  setTab('Message');
                }}
              >{`{{${token}}}`}</button>
            ))}
          </div>
        </MSection>
      </div>
      <button
        className="primary"
        disabled={
          busy || (!roles.length && !String(value.extraRecipients || '').trim())
        }
        type="submit"
      >
        {busy
          ? 'Saving…'
          : system
            ? 'Save system template'
            : automation
              ? 'Save automated message'
              : 'Save custom template'}
      </button>
    </form>
  );
}
