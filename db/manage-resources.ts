import type { PreparedStatement } from '@/db/raw';
import { rawDb } from './raw';
import { checkedWeek } from '@/lib/staff-scheduling';
import { configuration } from './store';
import {
  modules,
  checkedFields,
  type Resource,
  type Settings,
} from '@/lib/settings';
import {
  emptyDetails,
  details,
  fieldTypes,
  defaultLeadFields,
  leadFieldNames,
  type ResourceDetails,
  type FormField,
} from '@/lib/manage-config';
import { text } from '@/lib/crm';
import { layoutPresets } from '@/lib/design-collections';
import {
  conditionOptions,
  dateTriggers,
  recipientRoles,
  rolesFor,
  normalizedMessage,
} from '@/lib/message-catalog';

const list = (value: unknown, max: number, label: string): unknown[] => {
  if (!Array.isArray(value) || value.length > max)
    throw Error(`${label} supports up to ${max} items.`);
  return value;
};
const strings = (value: unknown, max: number, label: string, length = 120) => [
  ...new Set(
    list(value, max, label)
      .map((v) => text(v, label, length, false))
      .filter(Boolean),
  ),
];
const bool = (v: unknown) => {
  if (typeof v !== 'boolean') throw Error('Invalid checkbox value.');
  return v;
};
function parseDetails(value: unknown): ResourceDetails {
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw Error('Invalid advanced settings.');
  const d = { ...emptyDetails(), ...raw };
  if (!['all', 'selected', 'none'].includes(d.packageMode))
    throw Error('Choose valid package visibility.');
  const result: ResourceDetails = {
    version: 1,
    packageMode: d.packageMode,
    packageIds: strings(d.packageIds, 200, 'Packages'),
    includedPackageIds: strings(d.includedPackageIds, 200, 'Included packages'),
    images: strings(d.images, 20, 'Images'),
    attachments: strings(d.attachments, 20, 'Attachments'),
    requiredAddonIds: strings(d.requiredAddonIds, 30, 'Required add-ons'),
    tabs: strings(d.tabs, 20, 'Tabs', 80),
    tags: strings(d.tags, 50, 'Tags', 80),
    days: [
      ...new Set(
        list(d.days, 7, 'Weekdays').map((v) => {
          if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 6)
            throw Error('Invalid weekday.');
          return v;
        }),
      ),
    ],
    videos: list(d.videos, 10, 'Videos').map((v: any) => {
      const url = new URL(text(v.url, 'Video URL', 1000));
      if (url.protocol !== 'https:' || url.username || url.password)
        throw Error('Videos need an HTTPS URL.');
      return {
        title: text(v.title || 'Video', 'Video title', 120),
        url: url.href,
      };
    }),
    conditions: list(d.conditions, 30, 'Conditions').map((v: any) => ({
      field: text(v.field, 'Condition', 80),
      operator: text(v.operator, 'Condition operator', 30),
      value: text(v.value, 'Condition value', 500, false),
    })),
    fields: list(d.fields, 100, 'Questions').map((v: any): FormField => {
      if (!fieldTypes.includes(v.type))
        throw Error('Choose a supported field type.');
      return {
        id: text(v.id, 'Field ID', 100),
        label: text(
          v.label || (v.type === 'Separator' ? 'Separator' : ''),
          'Question label',
          500,
        ),
        type: v.type,
        hint: text(v.hint ?? '', 'Hint', 1000, false),
        placeholder: text(v.placeholder ?? '', 'Placeholder', 500, false),
        required: bool(v.required),
        options: strings(v.options ?? [], 100, 'Choices', 300),
        tab: text(v.tab || 'General', 'Tab', 80),
        repeat: bool(v.repeat ?? false),
        timeline: bool(v.timeline ?? false),
        conditionField: text(
          v.conditionField ?? '',
          'Conditional field',
          100,
          false,
        ),
        conditionValue: text(
          v.conditionValue ?? '',
          'Conditional answer',
          300,
          false,
        ),
      };
    }),
    leadFields: list(d.leadFields, 40, 'Lead fields').map((v: any) => {
      if (
        !leadFieldNames[v.key] ||
        !['Required', 'Optional', 'Hidden'].includes(v.display) ||
        !['50%', '100%'].includes(v.width)
      )
        throw Error('Invalid lead field.');
      if (v.key === 'email' && v.display !== 'Required')
        throw Error('Lead email is required.');
      return {
        key: v.key,
        label: text(v.label, 'Field label', 120),
        display: v.display,
        width: v.width,
      };
    }),
  };
  if (new Set(result.fields.map((f) => f.id)).size !== result.fields.length)
    throw Error('Question IDs must be unique.');
  for (const field of result.fields) {
    if (
      field.conditionField &&
      !result.fields.some(
        (f) => f.id === field.conditionField && f.id !== field.id,
      )
    )
      throw Error('Conditional question must reference another field.');
    let next = field.conditionField;
    const seen = new Set([field.id]);
    while (next) {
      if (seen.has(next))
        throw Error('Conditional questions cannot form a cycle.');
      seen.add(next);
      next = result.fields.find((f) => f.id === next)?.conditionField || '';
    }
  }
  if (
    new Set(result.leadFields.map((f) => f.key)).size !==
    result.leadFields.length
  )
    throw Error('Lead field keys must be unique.');
  return result;
}
export async function validateResource(
  bid: unknown,
  kind: string,
  input: unknown,
  previous?: Resource['data'],
) {
  if (
    !modules[kind] ||
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  )
    throw Error('Unknown resource type.');
  let source = { ...previous, ...(input as Record<string, unknown>) };
  if (['messages', 'automations', 'system_templates'].includes(kind)) {
    source = normalizedMessage({
      id: '',
      kind,
      name: '',
      archived: 0,
      data: source as Settings,
    }).data;
  }
  const data: Settings = checkedFields(source, modules[kind].fields);
  if (kind === 'staff' && source.bookingAvailability)
    data.bookingAvailability = JSON.stringify(checkedWeek(source.bookingAvailability));
  if (['messages', 'automations', 'system_templates'].includes(kind)) {
    if (!rolesFor(data).length && !String(data.extraRecipients || '').trim())
      throw Error('Choose at least one recipient.');
    if (data.channel === 'Email' && !data.subject)
      throw Error('Email subject is required.');
    if (String(data.body).length > 10000)
      throw Error('Message must be under 10,000 characters.');
    if (String(data.subject).length > 250)
      throw Error('Subject must be under 250 characters.');
    if (
      data.recipientRoles &&
      data.recipientRoles !== 'None' &&
      String(data.recipientRoles)
        .split('|')
        .some((r) => !recipientRoles.includes(r))
    )
      throw Error('Choose valid recipient roles.');
    for (const address of String(data.extraRecipients || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (
        data.channel === 'SMS'
          ? !/^\+?[\d ()-]{7,30}$/.test(address)
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
      )
        throw Error('Enter valid additional recipient addresses.');
    }
    if (kind === 'automations') {
      if (
        data.timing === 'Before' &&
        !dateTriggers.includes(String(data.eventTrigger))
      )
        throw Error('This trigger supports When, After or Manual timing.');
      if (
        ['Before', 'After'].includes(String(data.timing)) &&
        Number(data.offset) < 1
      )
        throw Error('Timing amount must be at least one.');
      if (['When', 'Manual'].includes(String(data.timing))) data.offset = 0;
    }
  }
  if (kind === 'discounts') {
    data.code = String(data.code).toUpperCase();
    if (data.mode === 'Percentage' && Number(data.amount) > 100)
      throw Error('Percentage discount cannot exceed 100%.');
  }
  if (
    kind === 'flex' &&
    source.details &&
    data.mode === 'Percentage' &&
    Number(data.amount) > 100
  )
    throw Error('Percentage must not exceed 100%.');
  for (const [a, b] of [
    ['starts', 'ends'],
    ['starts', 'expires'],
    ['bookStarts', 'bookEnds'],
  ])
    if (data[a] && data[b] && String(data[a]) > String(data[b]))
      throw Error('End date must follow start date.');
  for (const k of [
    'maxQuantity',
    'extensionMinutes',
    'leadDays',
    'maxRedemptions',
    'splitCount',
    'offset',
    'withinDays',
    'moreThanDays',
    'maxReviews',
    'maxPhotos',
    'capacity',
  ])
    if (data[k] !== undefined && !Number.isInteger(data[k]))
      throw Error('Counts and minutes must be whole numbers.');
  if (kind === 'flex' && data.locationType !== 'Any' && !data.locationValues)
    throw Error('Enter at least one location for this restriction.');
  if (kind === 'inventory_rules' && Number(data.capacity) < 1)
    throw Error('Capacity must be at least one.');
  if (kind === 'addons' && Number(data.maxQuantity) < 1)
    throw Error('Maximum quantity must be at least one.');
  if (kind === 'payment_plans' && Number(data.splitCount) < 1)
    throw Error('Choose at least one installment.');
  for (const k of ['endTimeStart', 'endTimeEnd'])
    if (data[k] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(data[k])))
      throw Error('Enter time as HH:MM.');
  if (
    kind === 'lead_forms' &&
    data.afterSubmit === 'Open URL' &&
    !data.redirectUrl
  )
    throw Error('Enter a redirect URL.');
  if (source.position !== undefined) {
    if (
      !Number.isSafeInteger(source.position) ||
      Number(source.position) < 0 ||
      Number(source.position) > 1000000
    )
      throw Error('Invalid order.');
    data.position = Number(source.position);
  }
  if (source.categoryId) {
    const category = await rawDb()
      .prepare(
        "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='categories' AND archived=0",
      )
      .bind(text(source.categoryId, 'Category'), bid)
      .first<{ data: string }>();
    if (!category || JSON.parse(category.data).ownerKind !== (['design_tags','design_layouts'].includes(kind) ? 'designs' : kind))
      throw Error('Choose a category from this business.');
    data.categoryId = String(source.categoryId);
  } else data.categoryId = '';
  if (['design_tags','design_layouts'].includes(kind) && !data.categoryId)
    throw Error('Choose a design collection.');
  if (kind === 'designs') {
    if (data.preset && !layoutPresets.includes(String(data.preset))) throw Error('Choose a supported layout preview.');
    for (const [key, type] of [['tagIds','design_tags'],['layoutIds','design_layouts']]) {
      const ids = strings(JSON.parse(String(source[key] || '[]')), 100, 'Design filters');
      for (const id of ids) {
        const row = await rawDb().prepare('SELECT data FROM resources WHERE id=? AND business_id=? AND kind=? AND archived=0').bind(id,bid,type).first<{data:string}>();
        if (!row || JSON.parse(row.data).categoryId !== data.categoryId) throw Error('Choose categories and layouts from this collection.');
      }
      data[key] = JSON.stringify(ids);
    }
  }
  if (source.details !== undefined) {
    const d = parseDetails(source.details),
      db = rawDb();
    if (kind === 'automations')
      for (const c of d.conditions) {
        if (
          !Object.hasOwn(conditionOptions, c.field) ||
          !['Is', 'Is not'].includes(c.operator)
        )
          throw Error('Choose a supported message condition.');
        if (!c.value.trim()) throw Error('Enter a condition value.');
      }
    if (kind === 'lead_forms' && !d.leadFields.length)
      d.leadFields = defaultLeadFields();
    const packageIds = [...new Set([...d.packageIds, ...d.includedPackageIds])];
    for (const id of packageIds)
      if (
        !(await db
          .prepare('SELECT id FROM packages WHERE id=? AND business_id=?')
          .bind(id, bid)
          .first())
      )
        throw Error(
          'A selected package belongs to another workspace or was removed.',
        );
    for (const id of [...d.images, ...d.attachments]) {
      const m = await db
        .prepare(
          "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='media' AND archived=0",
        )
        .bind(id, bid)
        .first<{ data: string }>();
      if (!m) throw Error('A selected file is unavailable in this workspace.');
      if (
        d.images.includes(id) &&
        !String(JSON.parse(m.data).mime).startsWith('image/')
      )
        throw Error('Choose an image file.');
    }
    for (const id of d.requiredAddonIds)
      if (
        !(await db
          .prepare(
            "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='addons' AND archived=0",
          )
          .bind(id, bid)
          .first())
      )
        throw Error('Choose an add-on from this workspace.');
    data.details = JSON.stringify(d);
  }
  if (
    data.assignee &&
    data.assignee !== 'owner' &&
    !(await rawDb()
      .prepare(
        "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='staff' AND archived=0",
      )
      .bind(data.assignee, bid)
      .first())
  )
    throw Error('Choose available staff from this workspace.');
  return data;
}
export async function resourceAction(
  bid: unknown,
  body: Record<string, any>,
): Promise<boolean> {
  if (
    ![
      'duplicate_resource',
      'delete_resource',
      'bulk_resources',
      'reorder_resources',
      'duplicate_category',
    ].includes(body.action)
  )
    return false;
  const db = rawDb(),
    now = new Date().toISOString(),
    { resources } = await configuration(bid);
  const ids =
    body.action === 'bulk_resources' || body.action === 'reorder_resources'
      ? strings(body.ids, 200, 'Selection')
      : [text(body.id, 'Record ID')];
  if (!ids.length) throw Error('Select at least one record.');
  const selected = ids.map((id) => {
    const r = resources.find((r) => r.id === id && r.kind !== 'media');
    if (!r) throw Error('Record not found in this workspace.');
    if (r.kind === 'system_templates')
      throw Error(
        'Use the System Templates editor to customize or restore defaults.',
      );
    return r;
  });
  if (body.kind && selected.some((r) => r.kind !== body.kind))
    throw Error('All selected records must have the same type.');
  const statements: PreparedStatement[] = [];
  const insert = (r: Resource, id: string, name: string, data: Settings) =>
    db
      .prepare(
        'INSERT INTO resources(id,business_id,kind,name,data,archived,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?)',
      )
      .bind(id, bid, r.kind, name, JSON.stringify(data), now, now);
  if (
    body.action === 'duplicate_resource' ||
    body.action === 'duplicate_category'
  ) {
    const r = selected[0],
      id = crypto.randomUUID();
    if (body.action === 'duplicate_category' && r.kind !== 'categories')
      throw Error('Choose a category.');
    const name = (r.name + ' (copy)').slice(0, 120);
    const data = { ...r.data };
    if (r.kind === 'discounts')
      data.code =
        String(data.code).slice(0, 72) + '-' + id.slice(0, 6).toUpperCase();
    statements.push(insert(r, id, name, data));
    if (r.kind === 'categories')
      for (const child of resources.filter((x) => x.data.categoryId === r.id))
        statements.push(
          insert(child, crypto.randomUUID(), child.name, {
            ...child.data,
            categoryId: id,
          }),
        );
  } else if (body.action === 'reorder_resources') {
    selected.forEach((r, i) =>
      statements.push(
        db
          .prepare(
            "UPDATE resources SET data=ed_set(data,'$.position',to_jsonb(CAST(? AS integer))),updated_at=? WHERE id=? AND business_id=?",
          )
          .bind(i, now, r.id, bid),
      ),
    );
  } else {
    const operation =
      body.action === 'delete_resource' ? 'delete' : body.operation;
    if (!['delete', 'archive', 'restore', 'update'].includes(operation))
      throw Error('Choose a valid bulk operation.');
    for (const r of selected) {
      if (operation === 'delete') {
        if (
          r.kind === 'categories' &&
          resources.some(
            (x) => x.data.categoryId === r.id && !ids.includes(x.id),
          )
        )
          throw Error('Move or delete the category’s items first.');
        statements.push(
          db
            .prepare('DELETE FROM resources WHERE id=? AND business_id=?')
            .bind(r.id, bid),
        );
      } else if (operation === 'archive' || operation === 'restore')
        statements.push(
          db
            .prepare(
              'UPDATE resources SET archived=?,updated_at=? WHERE id=? AND business_id=?',
            )
            .bind(operation === 'archive' ? 1 : 0, now, r.id, bid),
        );
      else {
        if (!body.patch || typeof body.patch !== 'object')
          throw Error('Choose fields to update.');
        const patch = { ...body.patch };
        if (r.kind === 'discounts' && patch.code !== undefined)
          throw Error('Edit discount codes individually.');
        // Package-scope edits preserve photos and all other advanced settings.
        if (patch.scope) {
          const d = details(r);
          patch.details = JSON.stringify({ ...d, ...patch.scope });
          delete patch.scope;
        }
        const data = await validateResource(bid, r.kind, patch, r.data);
        statements.push(
          db
            .prepare(
              'UPDATE resources SET data=?,updated_at=? WHERE id=? AND business_id=?',
            )
            .bind(JSON.stringify(data), now, r.id, bid),
        );
      }
    }
  }
  await db.batch(statements);
  return true;
}
