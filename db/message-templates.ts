import { rawDb } from './raw';
import { validateResource } from './manage-resources';
import { validatedSales } from './sales';
import {
  systemTemplates,
  normalizedMessage,
  timingLabel,
} from '@/lib/message-catalog';
import {
  contextId,
  messageContexts,
  messageIssues,
  messageRecipients,
  messageValues,
  renderMessage,
  messageSchedule,
} from '@/lib/message-preview';
import { text, type Data } from '@/lib/crm';
import type { Resource } from '@/lib/settings';

export async function systemTemplateAction(
  bid: unknown,
  body: Record<string, any>,
) {
  if (!['save_system_template', 'reset_system_template'].includes(body.action))
    return false;
  const template = systemTemplates.find((t) => t.key === body.systemKey);
  if (!template) throw Error('Unknown system template.');
  const db = rawDb(),
    id = `system-template:${bid}:${template.key}`,
    now = new Date().toISOString();
  if (body.action === 'reset_system_template') {
    await db
      .prepare(
        "DELETE FROM resources WHERE id=? AND business_id=? AND kind='system_templates'",
      )
      .bind(id, bid)
      .run();
  } else {
    const existing = await db
      .prepare(
        "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='system_templates'",
      )
      .bind(id, bid)
      .first<{ data: string }>();
    const data = await validateResource(
      bid,
      'system_templates',
      {
        ...template.data,
        ...body.data,
        channel: template.data.channel,
        systemKey: template.key,
        category: template.data.category,
      },
      existing ? JSON.parse(existing.data) : undefined,
    );
    await db
      .prepare(
        "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,'system_templates',?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,archived=0 WHERE resources.business_id=? AND resources.kind='system_templates'",
      )
      .bind(id, bid, template.name, JSON.stringify(data), now, now, bid)
      .run();
  }
  return true;
}
export async function prepareMessageDrafts(
  data: Data,
  body: Record<string, any>,
  origin = '',
) {
  const bid = data.business?.id;
  if (!bid) throw Error('Business unavailable.');
  let resource: Resource | undefined;
  if (body.systemKey) {
    const t = systemTemplates.find((t) => t.key === body.systemKey);
    if (!t) throw Error('Unknown system template.');
    resource = data.resources?.find(
      (r) =>
        r.kind === 'system_templates' &&
        r.data.systemKey === t.key &&
        !r.archived,
    ) || {
      id: 'system:' + t.key,
      kind: 'system_templates',
      name: t.name,
      data: t.data,
      archived: 0,
    };
  } else
    resource = data.resources?.find(
      (r) =>
        r.id === body.templateId &&
        ['messages', 'automations'].includes(r.kind) &&
        !r.archived,
    );
  if (!resource) throw Error('Template unavailable.');
  const r = normalizedMessage(resource),
    context = messageContexts(r, data).find(
      (c) => contextId(c) === body.contextId,
    );
  if (!context) throw Error('Choose a matching record from this business.');
  const issues = messageIssues(r, context, data);
  if (issues.length) throw Error(issues.join(' '));
  const recipients = messageRecipients(r, context, data);
  if (!recipients.length || recipients.length > 50)
    throw Error('Choose between 1 and 50 available recipients.');
  const input = body.values || {};
  if (
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length > 100
  )
    throw Error('Invalid preview values.');
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!/^[a-zA-Z0-9_]{1,80}$/.test(key)) throw Error('Invalid placeholder.');
    values[key] = text(value, 'Placeholder value', 2000);
    if (key.endsWith('_link')) {
      const url = new URL(values[key]);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw Error('Message links must use HTTPS.');
    }
  }
  const occurredAt = body.occurredAt
    ? text(body.occurredAt, 'Trigger time', 40)
    : '';
  if (occurredAt && !Number.isFinite(Date.parse(occurredAt)))
    throw Error('Enter a valid trigger time.');
  const schedule = messageSchedule(r, context, data, occurredAt),
    now = new Date().toISOString(),
    requestId = text(body.requestId, 'Request ID', 36);
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw Error('Invalid request ID.');
  const prepared = [];
  for (const recipient of recipients) {
    // Saved record values always take precedence over optional fill-in values.
    const replacements = {
        ...values,
        ...messageValues(context, data, recipient, origin),
      },
      subject = renderMessage(String(r.data.subject || ''), replacements),
      message = renderMessage(String(r.data.body || ''), replacements);
    if (subject.unresolved.length || message.unresolved.length)
      throw Error(
        'Fill in missing message values before creating drafts: ' +
          [...new Set([...subject.unresolved, ...message.unresolved])].join(
            ', ',
          ),
      );
    prepared.push(
      await validatedSales(bid, 'message', {
        eventId: context.event?.id || '',
        templateId: r.id,
        channel: r.data.channel,
        recipient: recipient.address,
        subject: subject.text,
        body: message.text,
        state: 'Awaiting Review',
        attachments:
          JSON.parse(String(r.data.details || '{}')).attachments || [],
        scheduledDate: schedule.date,
        scheduledTime: schedule.time,
        notes: `Prepared from ${r.name}. ${r.kind === 'automations' ? String(r.data.eventTrigger) + ' · ' + timingLabel(r) + '. ' : ''}${schedule.label}. Replies to: ${r.data.customReplyTo || r.data.replyTo || 'My business'}. No delivery is connected.`,
      }),
    );
  }
  const db = rawDb();
  await db.batch(
    prepared.map((draft, i) =>
      db
        .prepare(
          "INSERT INTO sales_records(id,business_id,kind,data,created_at,updated_at) VALUES(?,?,'message',?,?,?) ON CONFLICT(id) DO NOTHING",
        )
        .bind(
          `draft:${bid}:${requestId}:${i}`,
          bid,
          JSON.stringify(draft),
          now,
          now,
        ),
    ),
  );
}
