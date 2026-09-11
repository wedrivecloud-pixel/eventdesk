import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve('work/design-tests');
await mkdir(out, { recursive: true });
for (const name of ['settings', 'manage-config', 'design-collections'])
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
const {
  designSeed,
  designSnapshot,
  collectionTemplates,
  designQuestion,
  designSyncChange,
} = await import(pathToFileURL(`${out}/design-collections.mjs`));
const { emptyDetails, details } = await import(
  pathToFileURL(`${out}/manage-config.mjs`)
);
const seed = designSeed('test', []);
assert.equal(seed.length, 11);
assert.equal(seed[0].name, 'Layout Options');
assert.equal(details(seed[0]).fields.length, 1);
assert.equal(designSeed('test', seed).length, 0);
assert.ok(seed.slice(1).every((r) => details(r).packageMode === 'all'));
const custom = {
  ...seed[0],
  data: { ...seed[0].data, sortTemplates: 'Date Added' },
};
const dated = seed
  .slice(1, 3)
  .map((r, i) => ({ ...r, created_at: i ? '2045-02-01' : '2045-01-01' }));
assert.equal(collectionTemplates(dated, custom)[0].id, dated[1].id);
const previous = {
  collectionId: seed[0].id,
  name: 'Old',
  selectedId: seed[1].id,
  selectedTemplate: seed[1],
  answers: { custom: 'Keep me' },
};
const copied = designSnapshot(
  seed[0],
  seed,
  { items: [{ id: 'p' }] },
  previous,
);
assert.equal(copied.selectedId, previous.selectedId);
assert.equal(copied.answers.custom, 'Keep me');
assert.equal(
  designSyncChange(
    { items: [{ id: 'p' }], operations: { designCollections: [copied] } },
    seed,
    seed[0],
  ),
  '',
  'Already synchronized bookings are excluded from the preview',
);
console.log(
  'PASS: ten layout presets, repeat-safe seed, date sorting and preserved design choices.',
);
const base = 'http://localhost:3000',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  },
  prefix = 'Design QA ' + Date.now();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  'base64',
);
async function call(body, path = 'manage', auth = true) {
  const res = await fetch(`${base}/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}
async function ok(body, path) {
  const r = await call(body, path);
  assert.equal(r.status, 200, r.data.error || 'Request failed');
  return r.data;
}
async function reject(body) {
  assert.ok((await call(body)).status >= 400);
}
const initial = await ok(undefined, 'crm');
assert.equal(
  initial.business.id,
  'qa-business',
  'Only isolated local test workspace',
);
let packageId, eventId, mediaId;
async function create(kind, suffix, data) {
  const j = await ok({
    action: 'save_resource',
    kind,
    name: prefix + suffix,
    data,
  });
  return j.resources.find((r) => r.name === prefix + suffix);
}
try {
  assert.equal(
    (await call({ action: 'initialize_designs' }, 'manage', false)).status,
    401,
  );
  let j = await ok({ action: 'initialize_designs' });
  const ids = j.resources
    .filter((r) => r.id.startsWith('design:'))
    .map((r) => r.id)
    .sort();
  j = await ok({ action: 'initialize_designs' });
  assert.deepEqual(
    j.resources
      .filter((r) => r.id.startsWith('design:'))
      .map((r) => r.id)
      .sort(),
    ids,
  );
  j = await ok(
    {
      action: 'save_package',
      name: prefix,
      service: initial.business.services[0],
      price: 10000,
      duration: '1 hour',
      description: 'Isolated design workflow test',
    },
    'crm',
  );
  packageId = j.packages.find((p) => p.name === prefix).id;
  const q = { ...designQuestion(prefix + ':question'), required: true };
  const d = {
    ...emptyDetails(),
    packageMode: 'selected',
    packageIds: [packageId],
    fields: [q],
  };
  const c = await create('categories', ' Collection', {
    ownerKind: 'designs',
    sortTemplates: 'Alphabetically',
    details: JSON.stringify(d),
  });
  const c2 = await create('categories', ' Other', {
    ownerKind: 'designs',
    details: JSON.stringify({ ...emptyDetails(), packageMode: 'none' }),
  });
  const tag = await create('design_tags', ' Weddings', { categoryId: c.id });
  const layout = await create('design_layouts', ' 2x6', { categoryId: c.id });
  const t = await create('designs', ' Template', {
    categoryId: c.id,
    preset: '2x6 3 Photo',
    description: 'Before',
    tagIds: '[]',
    layoutIds: '[]',
    details: JSON.stringify({
      ...emptyDetails(),
      packageMode: 'selected',
      packageIds: [packageId],
      videos: [{ title: 'Reference', url: 'https://example.com/design-video' }],
    }),
  });
  await reject({
    action: 'save_resource',
    kind: 'designs',
    name: prefix + ' invalid',
    data: { categoryId: c2.id, tagIds: JSON.stringify([tag.id]) },
  });
  await reject({
    action: 'bulk_designs',
    collectionId: c2.id,
    ids: [t.id],
    operation: 'Add Categories',
    values: [tag.id],
  });
  for (const [operation, values, key] of [
    ['Add Categories', [tag.id], 'tagIds'],
    ['Add Layouts', [layout.id], 'layoutIds'],
  ]) {
    j = await ok({
      action: 'bulk_designs',
      collectionId: c.id,
      ids: [t.id],
      operation,
      values,
    });
    assert.deepEqual(
      JSON.parse(j.resources.find((r) => r.id === t.id).data[key]),
      values,
    );
  }
  j = await ok({
    action: 'bulk_designs',
    collectionId: c.id,
    ids: [t.id],
    operation: 'Remove Categories',
    values: [tag.id],
  });
  assert.deepEqual(
    JSON.parse(j.resources.find((r) => r.id === t.id).data.tagIds),
    [],
  );
  j = await ok({
    action: 'bulk_designs',
    collectionId: c.id,
    ids: [t.id],
    operation: 'Set Associated Packages',
    scope: { packageMode: 'selected', packageIds: [packageId] },
  });
  assert.equal(
    details(j.resources.find((r) => r.id === t.id)).videos.length,
    1,
  );
  j = await ok({ action: 'duplicate_design_collection', collectionId: c.id });
  const clone = j.resources.find((r) => r.name === c.name + ' (copy)');
  const clonedT = j.resources.find(
    (r) => r.kind === 'designs' && r.data.categoryId === clone.id,
  );
  const clonedLayout = j.resources.find(
    (r) => r.kind === 'design_layouts' && r.data.categoryId === clone.id,
  );
  assert.deepEqual(JSON.parse(clonedT.data.layoutIds), [clonedLayout.id]);
  assert.notEqual(details(clone).fields[0].id, q.id);
  await reject({
    action: 'delete_design_collection',
    collectionId: clone.id,
    confirm: 'wrong',
  });
  await ok({
    action: 'delete_design_collection',
    collectionId: clone.id,
    confirm: clone.name,
  });
  j = await ok(
    {
      action: 'save_event',
      title: prefix,
      client: 'Design Test Client',
      email: 'design-test@example.com',
      phone: '+15550002222',
      date: '2046-04-22',
      time: '12:00',
      packageIds: [packageId],
      deposit: 0,
    },
    'crm',
  );
  eventId = j.events.find((e) => e.title === prefix).id;
  const event = (data) => data.events.find((e) => e.id === eventId),
    booking = (data) =>
      event(data).operations.designCollections.find(
        (x) => x.collectionId === c.id,
      );
  assert.ok(!event(j).operations.designCollections?.length);
  await reject({
    action: 'sync_design_collection',
    collectionId: c.id,
    eventIds: [eventId],
    add: true,
    update: true,
    remove: false,
  });
  await ok({ action: 'advance_event', id: eventId, status: 'proposal' }, 'crm');
  j = await ok(
    { action: 'advance_event', id: eventId, status: 'confirmed' },
    'crm',
  );
  assert.equal(booking(j).templates.length, 1);
  await reject({
    action: 'save_design_choice',
    eventId,
    collectionId: c.id,
    templateId: t.id,
    answers: {},
  });
  await reject({
    action: 'save_design_choice',
    eventId,
    collectionId: c.id,
    templateId: 'foreign',
    answers: { [q.id]: 'Custom text' },
  });
  j = await ok({
    action: 'save_design_choice',
    eventId,
    collectionId: c.id,
    templateId: t.id,
    answers: { [q.id]: 'Avery & Jordan' },
  });
  assert.equal(booking(j).selectedId, t.id);
  await ok({
    action: 'save_resource',
    kind: 'designs',
    id: t.id,
    name: t.name,
    data: { ...t.data, description: 'Updated template' },
  });
  const q2 = {
    ...designQuestion(prefix + ':color'),
    type: 'Color Picker',
    label: 'Accent color',
  };
  const q3 = {
    ...designQuestion(prefix + ':file'),
    type: 'File Upload Field',
    label: 'Artwork',
  };
  await ok({
    action: 'save_resource',
    kind: 'categories',
    id: c.id,
    name: c.name,
    data: { ...c.data, details: JSON.stringify({ ...d, fields: [q, q2, q3] }) },
  });
  j = await ok({
    action: 'sync_design_collection',
    collectionId: c.id,
    eventIds: [eventId],
    add: true,
    update: true,
    remove: false,
  });
  assert.equal(booking(j).selectedId, t.id);
  assert.equal(booking(j).answers[q.id], 'Avery & Jordan');
  assert.equal(booking(j).templates[0].data.description, 'Updated template');
  assert.equal(booking(j).fields.length, 3);
  const fileRes = await fetch(
    base +
      '/api/question-file?' +
      new URLSearchParams({
        eventId,
        field: q3.id,
        name: prefix + ' Artwork.png',
      }),
    {
      method: 'PUT',
      headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
      body: png,
    },
  );
  assert.equal(fileRes.status, 200);
  const responseFile = await fileRes.json();
  await reject({
    action: 'save_design_choice',
    eventId,
    collectionId: c.id,
    templateId: t.id,
    answers: { [q.id]: 'Avery & Jordan', [q3.id]: 'foreign-file' },
  });
  j = await ok({
    action: 'save_design_choice',
    eventId,
    collectionId: c.id,
    templateId: t.id,
    answers: { [q.id]: 'Avery & Jordan', [q3.id]: responseFile.id },
  });
  assert.equal(booking(j).answers[q3.id], responseFile.id);
  const before = booking(j);
  j = await ok({
    action: 'sync_design_collection',
    collectionId: c.id,
    eventIds: [eventId],
    add: true,
    update: true,
    remove: false,
  });
  assert.deepEqual(booking(j), before);
  await reject({
    action: 'sync_design_collection',
    collectionId: c.id,
    eventIds: [eventId, 'foreign'],
    add: true,
    update: true,
    remove: false,
  });
  // Removing a catalog template retains the historical selected design and answer.
  await ok({ action: 'delete_resource', id: t.id });
  j = await ok({
    action: 'sync_design_collection',
    collectionId: c.id,
    eventIds: [eventId],
    add: true,
    update: true,
    remove: false,
  });
  assert.equal(booking(j).templates.length, 0);
  assert.equal(booking(j).selectedTemplate.id, t.id);
  j = await ok({
    action: 'save_design_choice',
    eventId,
    collectionId: c.id,
    templateId: t.id,
    answers: { [q.id]: 'Avery & Jordan', [q2.id]: '#123456' },
  });
  assert.equal(booking(j).answers[q2.id], '#123456');
  await ok({
    action: 'save_resource',
    kind: 'categories',
    id: c.id,
    name: c.name,
    data: { ...c.data, details: JSON.stringify({ ...d, packageMode: 'none' }) },
  });
  await reject({
    action: 'sync_design_collection',
    collectionId: c.id,
    eventIds: [eventId],
    add: false,
    update: false,
    remove: true,
  });
  j = await ok({
    action: 'sync_design_collection',
    collectionId: c.id,
    eventIds: [eventId],
    add: false,
    update: false,
    remove: true,
    confirm: 'REMOVE',
  });
  assert.ok(
    !event(j).operations.designCollections.some((x) => x.collectionId === c.id),
  );
  assert.ok(
    event(j).operations.designCollections.length > 0,
    'Other collections are untouched',
  );
  // Real media upload plus bulk creation, and design answer upload context.
  let res = await fetch(
    base +
      '/api/media?' +
      new URLSearchParams({ name: prefix + ' Upload.png' }),
    {
      method: 'PUT',
      headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
      body: png,
    },
  );
  assert.equal(res.status, 200);
  mediaId = (await res.json()).file.id;
  j = await ok({
    action: 'upload_designs',
    collectionId: c.id,
    mediaIds: [mediaId],
  });
  const uploaded = j.resources.find(
    (r) => r.kind === 'designs' && r.name === prefix + ' Upload',
  );
  assert.deepEqual(details(uploaded).images, [mediaId]);
  await reject({
    action: 'upload_designs',
    collectionId: c.id,
    mediaIds: ['foreign'],
  });
  await reject({
    action: 'bulk_designs',
    collectionId: c.id,
    ids: [uploaded.id],
    operation: 'Delete Templates',
  });
  await ok({
    action: 'bulk_designs',
    collectionId: c.id,
    ids: [uploaded.id],
    operation: 'Delete Templates',
    confirm: 'DELETE',
  });
  await ok({
    action: 'delete_design_filter',
    collectionId: c.id,
    id: layout.id,
  });
  const reload = await ok(undefined, 'crm');
  assert.ok(
    !event(reload).operations.designCollections.some(
      (x) => x.collectionId === c.id,
    ),
  );
  console.log(
    'PASS: collection CRUD, taxonomy ownership, bulk add/remove/scope, clone remapping, confirmed-booking attachment, validation, preserved selection/answers, sync isolation, bulk media creation and persisted reload.',
  );
} finally {
  const current = await ok(undefined, 'crm');
  const own = current.resources.filter(
    (r) => r.name.startsWith(prefix) && r.kind !== 'media',
  );
  if (own.length)
    await ok({
      action: 'bulk_resources',
      ids: own.map((r) => r.id),
      operation: 'delete',
    });
  if (mediaId) {
    const res = await fetch(base + '/api/media?id=' + mediaId, {
      method: 'DELETE',
      headers,
    });
    assert.equal(res.status, 200);
  }
  if (eventId)
    await ok(
      { action: 'event_lifecycle', ids: [eventId], lifecycle: 'Deleted' },
      'sales',
    );
  if (packageId)
    await ok(
      { action: 'delete_packages', ids: [packageId], confirm: 'DELETE' },
      'packages',
    );
}
