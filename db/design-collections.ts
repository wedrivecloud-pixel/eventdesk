import type { PreparedStatement } from '@/db/raw';
import { rawDb } from './raw';
import { configuration, operations } from './store';
import { validateResource } from './manage-resources';
import { validateQuestionFiles } from './question-files';
import { checkedAnswers } from '@/lib/manage-questions';
import {
  designCollections,
  designSeed,
  designIds,
  syncDesigns,
  type BookingDesignCollection,
} from '@/lib/design-collections';
import { details } from '@/lib/manage-config';
import { localToday } from '@/lib/manage-pricing';
import { text, type EventRecord } from '@/lib/crm';
import type { Resource, Settings } from '@/lib/settings';

const selectedIds = (v: unknown, max = 200): string[] => {
  if (!Array.isArray(v) || !v.length || v.length > max)
    throw Error(`Select between 1 and ${max} records.`);
  return [...new Set(v.map((id) => text(id, 'Record ID')))];
};
function insert(bid: unknown, r: Resource) {
  const now = new Date().toISOString();
  return rawDb()
    .prepare(
      'INSERT INTO resources(id,business_id,kind,name,data,archived,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
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
    );
}
async function writeDesigns(
  bid: unknown,
  id: string,
  next: BookingDesignCollection[],
  original: BookingDesignCollection[],
) {
  if (next.length > 50 || JSON.stringify(next).length > 500000)
    throw Error('This booking has reached its design collection limit.');
  const result = await rawDb()
    .prepare(
      "INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_set(event_operations.data,'$.designCollections',ed_json(?)) WHERE event_operations.business_id=? AND ed_json(COALESCE(ed_text(event_operations.data,'$.designCollections'),'[]'))=ed_json(?)",
    )
    .bind(
      id,
      bid,
      JSON.stringify({ designCollections: next }),
      JSON.stringify(next),
      bid,
      JSON.stringify(original),
    )
    .run();
  if (!result.meta.changes)
    throw Error('Design choices changed while saving. Refresh and try again.');
}
async function eventFor(bid: unknown, id: string): Promise<EventRecord> {
  const row = await rawDb()
    .prepare(
      "SELECT * FROM events WHERE id=? AND business_id=? AND lifecycle='Active'",
    )
    .bind(id, bid)
    .first<Record<string, unknown>>();
  if (!row) throw Error('Booking unavailable in this workspace.');
  return {
    ...row,
    items: JSON.parse(String(row.items)),
    operations: await operations(id, bid),
  } as EventRecord;
}
export async function addBookingDesigns(bid: unknown, id: string) {
  const { resources } = await configuration(bid),
    event = await eventFor(bid, id);
  const before = event.operations?.designCollections || [];
  for (const c of designCollections(resources))
    event.operations!.designCollections = syncDesigns(event, resources, c, {
      add: true,
      update: false,
      remove: false,
    });
  const after = event.operations?.designCollections || [];
  if (JSON.stringify(after) !== JSON.stringify(before))
    await writeDesigns(bid, id, after, before);
}
export async function designAction(bid: unknown, body: Record<string, any>) {
  if (
    ![
      'initialize_designs',
      'duplicate_design_collection',
      'delete_design_collection',
      'delete_design_filter',
      'bulk_designs',
      'upload_designs',
      'sync_design_collection',
      'save_design_choice',
    ].includes(body.action)
  )
    return false;
  const db = rawDb(),
    config = await configuration(bid),
    resources = config.resources;
  if (body.action === 'initialize_designs') {
    const marker = `design:${bid}:initialized`;
    if (resources.some((r) => r.id === marker)) return true;
    const rows = [
      ...designSeed(String(bid), resources),
      {
        id: marker,
        kind: 'design_setup',
        name: 'Design collection setup',
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
    return true;
  }
  if (body.action === 'save_design_choice') {
    const id = text(body.eventId, 'Booking ID'),
      event = await eventFor(bid, id),
      before = event.operations?.designCollections || [];
    const current = before.find((c) => c.collectionId === body.collectionId);
    if (!current)
      throw Error('This collection is not assigned to the booking.');
    const templateId = text(body.templateId, 'Template ID', 200, false);
    const selected =
      current.templates.find((t) => t.id === templateId) ||
      (templateId === current.selectedId
        ? current.selectedTemplate
        : undefined);
    if (templateId && !selected)
      throw Error('Choose an available template for this booking.');
    const answers = checkedAnswers(body.answers, current.fields);
    await validateQuestionFiles(
      String(bid),
      'event:' + id,
      answers,
      current.fields,
    );
    const next = before.map((c) =>
      c.collectionId === current.collectionId
        ? {
            ...c,
            selectedId: templateId,
            selectedTemplate: selected,
            answers: { ...c.answers, ...answers },
          }
        : c,
    );
    await writeDesigns(bid, id, next, before);
    return true;
  }
  const collection = resources.find(
    (r) =>
      r.id === body.collectionId &&
      r.kind === 'categories' &&
      r.data.ownerKind === 'designs' &&
      !r.archived,
  );
  if (!collection) throw Error('Design collection unavailable.');
  const children = resources.filter((r) => r.data.categoryId === collection.id);
  if (body.action === 'duplicate_design_collection') {
    if (children.length > 500)
      throw Error('Duplicate collections with up to 500 records.');
    const ids = new Map(
      [collection, ...children].map((r) => [r.id, crypto.randomUUID()]),
    );
    const cloned = [collection, ...children].map((r) => {
      const data = { ...r.data };
      if (r !== collection) data.categoryId = ids.get(collection.id)!;
      if (r.kind === 'designs')
        for (const key of ['tagIds', 'layoutIds'] as const)
          data[key] = JSON.stringify(
            designIds(r, key)
              .map((id) => ids.get(id))
              .filter(Boolean),
          );
      if (r === collection) {
        const questionIds = new Map(
          details(r).fields.map((q) => [q.id, crypto.randomUUID()]),
        );
        data.details = JSON.stringify({
          ...details(r),
          fields: details(r).fields.map((q) => ({
            ...q,
            id: questionIds.get(q.id),
            conditionField: questionIds.get(q.conditionField) || '',
          })),
        });
      }
      return {
        ...r,
        id: ids.get(r.id)!,
        name: r === collection ? (r.name + ' (copy)').slice(0, 120) : r.name,
        data,
      };
    });
    await db.batch(cloned.map((r) => insert(bid, r)));
  } else if (body.action === 'delete_design_collection') {
    if (body.confirm !== collection.name)
      throw Error('Type the collection name to confirm deletion.');
    await db.batch(
      [collection, ...children].map((r) =>
        db
          .prepare('DELETE FROM resources WHERE id=? AND business_id=?')
          .bind(r.id, bid),
      ),
    );
  } else if (body.action === 'delete_design_filter') {
    const filter = children.find(
      (r) =>
        r.id === body.id && ['design_tags', 'design_layouts'].includes(r.kind),
    );
    if (!filter) throw Error('Category or layout unavailable.');
    const key = filter.kind === 'design_tags' ? 'tagIds' : 'layoutIds';
    const writes = children
      .filter(
        (r) => r.kind === 'designs' && designIds(r, key).includes(filter.id),
      )
      .map((r) =>
        db
          .prepare(
            'UPDATE resources SET data=?,updated_at=? WHERE id=? AND business_id=?',
          )
          .bind(
            JSON.stringify({
              ...r.data,
              [key]: JSON.stringify(
                designIds(r, key).filter((id) => id !== filter.id),
              ),
            }),
            new Date().toISOString(),
            r.id,
            bid,
          ),
      );
    await db.batch([
      ...writes,
      db
        .prepare('DELETE FROM resources WHERE id=? AND business_id=?')
        .bind(filter.id, bid),
    ]);
  } else if (body.action === 'bulk_designs') {
    const ids = selectedIds(body.ids),
      selected = ids.map((id) =>
        children.find(
          (r) => r.id === id && r.kind === 'designs' && !r.archived,
        ),
      );
    if (selected.some((r) => !r))
      throw Error('Select templates from this collection.');
    const action = String(body.operation),
      writes: PreparedStatement[] = [];
    if (
      ![
        'Add Categories',
        'Remove Categories',
        'Add Layouts',
        'Remove Layouts',
        'Set Associated Packages',
        'Delete Templates',
      ].includes(action)
    )
      throw Error('Choose a bulk action.');
    if (action === 'Delete Templates' && body.confirm !== 'DELETE')
      throw Error('Type DELETE to remove selected templates.');
    for (const r of selected as Resource[]) {
      if (action === 'Delete Templates') {
        writes.push(
          db
            .prepare('DELETE FROM resources WHERE id=? AND business_id=?')
            .bind(r.id, bid),
        );
        continue;
      }
      const patch: Settings = {};
      if (action === 'Set Associated Packages')
        patch.details = JSON.stringify({
          ...details(r),
          packageMode: body.scope?.packageMode,
          packageIds: body.scope?.packageIds,
        });
      else {
        const key = action.includes('Categories') ? 'tagIds' : 'layoutIds',
          type = key === 'tagIds' ? 'design_tags' : 'design_layouts';
        const values = selectedIds(body.values, 100);
        if (
          values.some(
            (id) =>
              !children.some(
                (c) => c.id === id && c.kind === type && !c.archived,
              ),
          )
        )
          throw Error('Choose categories or layouts from this collection.');
        patch[key] = JSON.stringify(
          action.startsWith('Add')
            ? [...new Set([...designIds(r, key), ...values])]
            : designIds(r, key).filter((id) => !values.includes(id)),
        );
      }
      const data = await validateResource(bid, 'designs', patch, r.data);
      writes.push(
        db
          .prepare(
            'UPDATE resources SET data=?,updated_at=? WHERE id=? AND business_id=?',
          )
          .bind(JSON.stringify(data), new Date().toISOString(), r.id, bid),
      );
    }
    await db.batch(writes);
  } else if (body.action === 'upload_designs') {
    const ids = selectedIds(body.mediaIds, 20),
      rows: Resource[] = [];
    for (const id of ids) {
      const media = resources.find(
        (r) =>
          r.id === id &&
          r.kind === 'media' &&
          !r.archived &&
          String(r.data.mime).startsWith('image/'),
      );
      if (!media) throw Error('Choose images from this workspace.');
      const data = await validateResource(bid, 'designs', {
        categoryId: collection.id,
        details: JSON.stringify({
          ...details(collection),
          fields: [],
          images: [id],
        }),
      });
      rows.push({
        id: crypto.randomUUID(),
        kind: 'designs',
        name: media.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Design',
        archived: 0,
        data: { ...data, position: children.length + rows.length },
      });
    }
    await db.batch(rows.map((r) => insert(bid, r)));
  } else if (body.action === 'sync_design_collection') {
    const ids = selectedIds(body.eventIds, 500);
    for (const key of ['add', 'update', 'remove'])
      if (typeof body[key] !== 'boolean')
        throw Error('Choose valid sync options.');
    if (body.remove && body.confirm !== 'REMOVE')
      throw Error(
        'Type REMOVE to remove nonmatching collections from bookings.',
      );
    // Validate every selected booking before writing any changes.
    const events: EventRecord[] = [];
    for (const id of ids) {
      const event = await eventFor(bid, id);
      if (
        event.status !== 'confirmed' ||
        event.date < localToday(config.settings)
      )
        throw Error('Sync applies to upcoming confirmed bookings only.');
      events.push(event);
    }
    for (const event of events) {
      const before = event.operations?.designCollections || [],
        next = syncDesigns(event, resources, collection, {
          add: body.add,
          update: body.update,
          remove: body.remove,
        });
      if (JSON.stringify(before) !== JSON.stringify(next))
        await writeDesigns(bid, event.id, next, before);
    }
  }
  return true;
}
