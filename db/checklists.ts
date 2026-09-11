import type { PreparedStatement } from '@/db/raw';
import { rawDb } from './raw';
import { configuration, operations } from './store';
import { checklistSeed, checklistItems } from '@/lib/checklist-catalog';
import { appliesTo } from '@/lib/manage-config';
import { templatePatch } from '@/lib/manage-templates';
import { localToday } from '@/lib/manage-pricing';
import { text, type EventRecord } from '@/lib/crm';
import type { Resource } from '@/lib/settings';

export async function initializeChecklists(bid: unknown) {
  const db = rawDb(),
    marker = `checklist:${bid}:initialized`;
  if (
    await db
      .prepare('SELECT id FROM resources WHERE id=? AND business_id=?')
      .bind(marker, bid)
      .first()
  )
    return;
  const { resources } = await configuration(bid);
  const rows = [
    ...checklistSeed(String(bid), resources),
    {
      id: marker,
      kind: 'checklist_setup',
      name: 'Checklist setup',
      archived: 0,
      data: { version: 1 },
    },
  ];
  const now = new Date().toISOString();
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          'INSERT INTO resources(id,business_id,kind,name,data,archived,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM resources WHERE id=? AND business_id=?) ON CONFLICT DO NOTHING',
        )
        .bind(
          r.id,
          bid,
          r.kind,
          r.name,
          JSON.stringify(r.data),
          r.archived,
          now,
          now,
          marker,
          bid,
        ),
    ),
  );
}

export async function applyChecklistItems(
  bid: unknown,
  templates: Resource[],
  eventIds: string[],
  mode: 'sync' | 'reset' | 'missing' = 'sync',
  categoryId = '',
) {
  const db = rawDb(),
    config = await configuration(bid),
    writes: PreparedStatement[] = [];
  for (const id of eventIds) {
    const raw = await db
      .prepare(
        "SELECT * FROM events WHERE id=? AND business_id=? AND lifecycle='Active'",
      )
      .bind(id, bid)
      .first<Record<string, unknown>>();
    if (!raw) throw Error('Booking unavailable in this workspace.');
    if (
      mode === 'reset' &&
      (raw.status !== 'confirmed' ||
        String(raw.date) < localToday(config.settings))
    )
      throw Error('Only upcoming confirmed bookings can be reset.');
    const ops = await operations(id, bid),
      original = JSON.stringify(ops.tasks || []);
    const event = {
      ...raw,
      items: JSON.parse(String(raw.items)),
      operations: { ...ops },
    } as EventRecord;
    if (mode === 'reset')
      event.operations!.tasks = (ops.tasks || []).filter(
        (t: { categoryId?: string; templateId?: string }) =>
          t.categoryId !== categoryId &&
          !templates.some((r) => r.id === t.templateId),
      );
    for (const template of templates) {
      if (
        !appliesTo(
          template,
          event.items.map((p) => p.id),
        )
      )
        continue;
      if (
        mode === 'missing' &&
        event.operations!.tasks?.some((t) => t.templateId === template.id)
      )
        continue;
      const patch = templatePatch(
        template,
        event,
        config.settings,
        mode !== 'reset',
        config.resources,
      );
      event.operations!.tasks = patch.tasks;
    }
    const next = event.operations!.tasks || [];
    if (next.length > 200)
      throw Error('A booking has reached its 200-item checklist limit.');
    if (JSON.stringify(next) === original) continue;
    writes.push(
      db
        .prepare(
          "INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_set(event_operations.data,'$.tasks',ed_json(?)) WHERE event_operations.business_id=? AND ed_json(COALESCE(ed_text(event_operations.data,'$.tasks'),'[]'))=ed_json(?)",
        )
        .bind(
          id,
          bid,
          JSON.stringify({ tasks: next }),
          JSON.stringify(next),
          bid,
          original,
        ),
    );
  }
  if (writes.length) {
    const results = await db.batch(writes);
    if (results.some((r) => !r.meta.changes))
      throw Error(
        'A checklist changed while saving. Refresh and synchronize again.',
      );
  }
}
export async function upcomingChecklistBookings(bid: unknown) {
  const { settings } = await configuration(bid);
  const rows = await rawDb()
    .prepare(
      "SELECT id FROM events WHERE business_id=? AND status='confirmed' AND lifecycle='Active' AND date>=? ORDER BY date LIMIT 501",
    )
    .bind(bid, localToday(settings))
    .all<{ id: string }>();
  if (rows.results.length > 500)
    throw Error('Choose up to 500 upcoming bookings at a time.');
  return rows.results.map((r) => r.id);
}
export async function addBookingChecklists(bid: unknown, eventId: string) {
  const config = await configuration(bid);
  const templates = config.resources.filter(
    (r) =>
      r.kind === 'checklists' &&
      !r.archived &&
      !config.resources.some((c) => c.id === r.data.categoryId && c.archived),
  );
  await applyChecklistItems(bid, templates, [eventId], 'missing');
}
export async function checklistAction(
  bid: unknown,
  body: Record<string, unknown>,
) {
  if (body.action === 'initialize_checklists') {
    await initializeChecklists(bid);
    return true;
  }
  if (
    !['apply_checklist_category', 'reset_checklist_category'].includes(
      String(body.action),
    )
  )
    return false;
  const { resources } = await configuration(bid);
  const category = resources.find(
    (r) =>
      r.id === body.categoryId &&
      r.kind === 'categories' &&
      r.data.ownerKind === 'checklists' &&
      !r.archived,
  );
  if (!category) throw Error('Checklist category unavailable.');
  if (
    !Array.isArray(body.eventIds) ||
    !body.eventIds.length ||
    body.eventIds.length > 500
  )
    throw Error('Select between 1 and 500 bookings.');
  const ids = [...new Set(body.eventIds.map((id) => text(id, 'Booking ID')))];
  const reset = body.action === 'reset_checklist_category';
  if (reset && body.confirm !== 'RESET')
    throw Error('Type RESET to replace this category’s booking checklists.');
  await applyChecklistItems(
    bid,
    checklistItems(resources, category.id),
    ids,
    reset ? 'reset' : 'sync',
    category.id,
  );
  return true;
}
