import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve('work/checklists-test');
await mkdir(out, { recursive: true });
for (const name of [
  'settings',
  'manage-config',
  'manage-pricing',
  'manage-templates',
  'checklist-catalog',
]) {
  await writeFile(
    `${out}/${name}.mjs`,
    ts
      .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from '(.\/[^']+)'/g, (_, p) => `from '${p}.mjs'`),
  );
}
const { checklistSeed, checklistCatalog, checklistInTodo } = await import(
  pathToFileURL(`${out}/checklist-catalog.mjs`)
);
const { templatePatch } = await import(
  pathToFileURL(`${out}/manage-templates.mjs`)
);
const { emptyDetails } = await import(
  pathToFileURL(`${out}/manage-config.mjs`)
);
const seed = checklistSeed('business', []),
  categories = seed.filter((r) => r.kind === 'categories'),
  items = seed.filter((r) => r.kind === 'checklists');
assert.equal(categories.length, 3);
assert.equal(items.length, 18);
assert.deepEqual(
  checklistCatalog.map((c) => c.items.length),
  [12, 4, 2],
);
assert.equal(
  checklistSeed('business', seed).length,
  0,
  'Seed planning reuses existing records',
);
assert.ok(
  items.every((r) => JSON.parse(r.data.details).packageMode === 'none'),
);
const event = {
  id: 'event',
  date: '2045-09-26',
  items: [{ id: 'p' }],
  status: 'confirmed',
  created_at: '2045-01-01T12:00:00Z',
  operations: {
    sales: { confirmedAt: '2045-08-31T01:00:00Z' },
    quote: { dueDate: '2045-09-20' },
  },
};
const activate = (r) => ({
  ...r,
  data: { ...r.data, details: JSON.stringify(emptyDetails()) },
});
for (const r of items) {
  const t = templatePatch(activate(r), event, {}, false, seed).tasks[0];
  assert.equal(t.categoryId, r.data.categoryId);
  if (!r.data.automaticDue) assert.equal(t.due, '');
}
let item = activate(
  items.find((r) => r.name === 'Confirm venue insurance requirements'),
);
assert.equal(
  templatePatch(item, event, {}, false, seed).tasks[0].due,
  '2045-09-05',
);
item = {
  ...item,
  data: {
    ...item.data,
    dateBasis: 'Book date',
    offset: 1,
    timeUnit: 'Days',
    timing: 'After',
  },
};
assert.equal(
  templatePatch(item, event, {}, false, seed).tasks[0].due,
  '2045-08-31',
  'Book date uses confirmation in business timezone',
);
item.data.dateBasis = 'Payment due date';
assert.equal(
  templatePatch(item, event, {}, false, seed).tasks[0].due,
  '2045-09-21',
);
assert.equal(
  templatePatch(item, { ...event, operations: {} }, {}, false, seed).tasks[0]
    .due,
  '',
  'Unknown basis does not invent a date',
);
const hidden = {
  ...categories[0],
  data: { ...categories[0].data, showTodo: false },
};
assert.equal(
  checklistInTodo({ templateId: items[0].id }, [items[0], hidden]),
  false,
  'Category visibility applies to old task copies',
);
console.log(
  'PASS: 3 categories, 18 items, repeat-safe seed, correct pre/post dates, confirmation timezone and To-do visibility.',
);

const base = 'http://localhost:3000';
const headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  },
  tag = 'Checklist QA ' + Date.now();
async function call(body, path = 'manage', auth = true) {
  const r = await fetch(`${base}/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function ok(body, path) {
  const r = await call(body, path);
  assert.equal(r.status, 200, r.data.error || 'Request failed');
  return r.data;
}
const initial = await ok(undefined, 'crm');
assert.equal(
  initial.business.id,
  'qa-business',
  'Local test business only',
);
const resourceIds = [],
  eventIds = [];
let packageId;
async function resource(kind, name, data) {
  const j = await ok({ action: 'save_resource', kind, name: tag + name, data });
  const r = j.resources.find((r) => r.name === tag + name);
  resourceIds.push(r.id);
  return r;
}
try {
  assert.equal(
    (await call({ action: 'initialize_checklists' }, 'manage', false)).status,
    401,
  );
  let j = await ok({ action: 'initialize_checklists' });
  const seededIds = j.resources
    .filter((r) => r.id.startsWith(`checklist:${initial.business.id}:`))
    .map((r) => r.id)
    .sort();
  j = await ok({ action: 'initialize_checklists' });
  assert.deepEqual(
    j.resources
      .filter((r) => r.id.startsWith(`checklist:${initial.business.id}:`))
      .map((r) => r.id)
      .sort(),
    seededIds,
  );
  const pd = await ok(
    {
      action: 'save_package',
      name: tag,
      service: initial.business.services[0],
      price: 10000,
      duration: '1 hour',
      description: 'Local checklist test',
    },
    'crm',
  );
  packageId = pd.packages.find((p) => p.name === tag).id;
  const cat = await resource('categories', ' Pre-event', {
    ownerKind: 'checklists',
    showTodo: false,
    staffView: true,
    staffEdit: false,
    clientView: false,
  });
  const otherCat = await resource('categories', ' Post-event', {
    ownerKind: 'checklists',
  });
  const scope = JSON.stringify({
    ...emptyDetails(),
    packageMode: 'selected',
    packageIds: [packageId],
  });
  const pre = await resource('checklists', ' Confirm venue', {
    categoryId: cat.id,
    body: 'Confirm venue',
    notes: 'Call coordinator',
    assignee: 'owner',
    automaticDue: true,
    offset: 3,
    timeUnit: 'Weeks',
    timing: 'Before',
    dateBasis: 'Event date',
    details: scope,
  });
  const post = await resource('checklists', ' Upload photos', {
    categoryId: otherCat.id,
    body: 'Upload photos',
    automaticDue: true,
    offset: 2,
    timeUnit: 'Days',
    timing: 'After',
    details: scope,
  });
  const eq = await resource('checklists', ' Equipment', {
    categoryId: cat.id,
    body: 'Equipment',
    automaticDue: false,
    details: scope,
  });
  j = await ok(
    {
      action: 'save_event',
      title: tag,
      client: 'Checklist Test Client',
      email: 'checklist-test@example.com',
      phone: '+15550001111',
      date: '2045-09-26',
      time: '12:00',
      packageIds: [packageId],
      deposit: 0,
    },
    'crm',
  );
  const eventId = j.events.find((e) => e.title === tag).id;
  eventIds.push(eventId);
  const getTasks = (data) =>
    data.events.find((e) => e.id === eventId).operations.tasks || [];
  assert.equal(
    getTasks(j).length,
    0,
    'Unapproved booking gets no checklist automatically',
  );
  await ok({ action: 'advance_event', id: eventId, status: 'proposal' }, 'crm');
  j = await ok(
    { action: 'advance_event', id: eventId, status: 'confirmed' },
    'crm',
  );
  let tasks = getTasks(j).filter((t) =>
    [pre.id, post.id, eq.id].includes(t.templateId),
  );
  assert.equal(
    tasks.length,
    3,
    'Confirmation attaches applicable checklist items',
  );
  let task = tasks.find((t) => t.templateId === pre.id);
  assert.equal(task.due, '2045-09-05');
  assert.equal(task.assignee, 'owner');
  assert.equal(task.showTodo, false);
  assert.equal(task.staffEdit, false);
  assert.equal(tasks.find((t) => t.templateId === post.id).due, '2045-09-28');
  assert.equal(tasks.find((t) => t.templateId === eq.id).due, '');
  await ok({ action: 'save_planning', eventId, taskId: task.id, done: true });
  j = await ok({
    action: 'save_resource',
    id: pre.id,
    kind: 'checklists',
    name: pre.name,
    data: { ...pre.data, notes: 'Updated coordinator notes', offset: 1 },
    syncExisting: true,
  });
  task = getTasks(j).find((t) => t.templateId === pre.id);
  assert.equal(task.done, true);
  assert.equal(task.notes, 'Updated coordinator notes');
  assert.equal(task.due, '2045-09-19');
  j = await ok({
    action: 'apply_checklist_category',
    categoryId: cat.id,
    eventIds: [eventId],
  });
  assert.equal(
    getTasks(j).filter((t) => t.categoryId === cat.id).length,
    2,
    'Synchronization does not duplicate items',
  );
  assert.equal(getTasks(j).find((t) => t.templateId === pre.id).done, true);
  assert.ok(
    (
      await call({
        action: 'reset_checklist_category',
        categoryId: cat.id,
        eventIds: [eventId],
      })
    ).status >= 400,
  );
  const untouched = getTasks(j).find((t) => t.templateId === post.id);
  j = await ok({
    action: 'reset_checklist_category',
    categoryId: cat.id,
    eventIds: [eventId],
    confirm: 'RESET',
  });
  assert.equal(getTasks(j).find((t) => t.templateId === pre.id).done, false);
  assert.deepEqual(
    getTasks(j).find((t) => t.templateId === post.id),
    untouched,
    'Reset preserves other categories',
  );
  assert.ok(
    (
      await call({
        action: 'apply_checklist_category',
        categoryId: crypto.randomUUID(),
        eventIds: [eventId],
      })
    ).status >= 400,
  );
  assert.ok(
    (
      await call({
        action: 'apply_checklist_category',
        categoryId: cat.id,
        eventIds: [crypto.randomUUID()],
      })
    ).status >= 400,
  );
  const invalid = await call({
    action: 'save_resource',
    kind: 'checklists',
    name: tag + ' invalid',
    data: { ...pre.data, categoryId: crypto.randomUUID() },
  });
  assert.ok(invalid.status >= 400);
  j = await ok({ action: 'duplicate_resource', id: pre.id });
  const duplicate = j.resources.find((r) => r.name === pre.name + ' (copy)');
  resourceIds.push(duplicate.id);
  assert.equal(duplicate.data.categoryId, cat.id);
  assert.equal(duplicate.data.notes, 'Updated coordinator notes');
  j = await ok({ action: 'reorder_resources', ids: [eq.id, pre.id] });
  assert.equal(j.resources.find((r) => r.id === eq.id).data.position, 0);
  assert.equal(
    (await ok(undefined, 'crm')).events
      .find((e) => e.id === eventId)
      .operations.tasks.find((t) => t.templateId === pre.id).done,
    false,
  );
  console.log(
    'PASS: persistent/idempotent setup; scoped CRUD, duplicate/reorder; approved-booking attachment; due dates, assignment, completion, synchronization, reset isolation and ownership validation.',
  );
} finally {
  for (const id of resourceIds.reverse())
    await ok({ action: 'delete_resource', id });
  if (eventIds.length)
    await ok(
      { action: 'event_lifecycle', ids: eventIds, lifecycle: 'Deleted' },
      'sales',
    );
  if (packageId)
    await ok(
      { action: 'delete_packages', ids: [packageId], confirm: 'DELETE' },
      'packages',
    );
}
