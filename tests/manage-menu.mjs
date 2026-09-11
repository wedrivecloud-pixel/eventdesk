import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = 'http://localhost:3000',
  tag = 'Manage QA ' + Date.now(),
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  };
async function call(path, body, auth = true) {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function ok(path, body, auth = true) {
  const r = await call(path, body, auth);
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
}
const initial = await ok('crm'),
  created = [],
  eventIds = [];
let mediaId;
const d = (patch = {}) =>
  JSON.stringify({
    version: 1,
    packageMode: 'all',
    packageIds: [],
    includedPackageIds: [],
    images: [],
    videos: [],
    attachments: [],
    fields: [],
    tabs: ['General'],
    conditions: [],
    days: [0, 1, 2, 3, 4, 5, 6],
    leadFields: [],
    tags: [],
    requiredAddonIds: [],
    ...patch,
  });
async function resource(kind, suffix, data) {
  const name = tag + ' ' + suffix,
    j = await ok('manage', { action: 'save_resource', kind, name, data }),
    r = j.resources.find((r) => r.kind === kind && r.name === name);
  created.push(r.id);
  return r;
}
try {
  const category = await resource('categories', 'category', {
      ownerKind: 'addons',
      price: 15,
      details: d(),
    }),
    a = await resource('addons', 'extra', {
      price: 12,
      maxQuantity: 4,
      categoryId: category.id,
      details: d(),
    }),
    b = await resource('addons', 'extra2', {
      price: 20,
      categoryId: category.id,
      details: d(),
    });
  let j = await ok('manage', {
    action: 'bulk_resources',
    kind: 'addons',
    ids: [a.id, b.id],
    operation: 'update',
    patch: { price: 25, maxQuantity: 3 },
  });
  assert.equal(j.resources.find((r) => r.id === a.id).data.price, 25);
  assert.equal(j.resources.find((r) => r.id === b.id).data.maxQuantity, 3);
  const invalid = await call('manage', {
    action: 'bulk_resources',
    kind: 'addons',
    ids: [a.id, randomUUID()],
    operation: 'update',
    patch: { price: 900 },
  });
  assert.ok(invalid.status >= 400);
  j = await ok('crm');
  assert.equal(
    j.resources.find((r) => r.id === a.id).data.price,
    25,
    'failed bulk is atomic',
  );
  assert.ok(
    (
      await call('manage', {
        action: 'save_resource',
        kind: 'addons',
        id: a.id,
        name: a.name,
        data: {
          ...a.data,
          details: d({ packageMode: 'selected', packageIds: [randomUUID()] }),
        },
      })
    ).status >= 400,
  );
  j = await ok('manage', { action: 'duplicate_category', id: category.id });
  for (const r of j.resources.filter(
    (r) => r.name.startsWith(tag) && !created.includes(r.id),
  ))
    created.push(r.id);
  assert.equal(
    j.resources.filter((r) => r.kind === 'addons' && r.name.startsWith(tag))
      .length,
    4,
  );
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await fetch(base + '/api/media?name=manage.png', {
    method: 'PUT',
    headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(upload.status, 200);
  mediaId = (await upload.json()).file.id;
  await ok('manage', {
    action: 'save_resource',
    kind: 'addons',
    id: a.id,
    name: a.name,
    data: {
      price: 25,
      maxQuantity: 3,
      categoryId: category.id,
      details: d({ images: [mediaId] }),
    },
  });
  assert.equal((await fetch(base + '/api/media?id=' + mediaId)).status, 404);
  assert.equal(
    (
      await fetch(base + '/api/media?id=' + mediaId, {
        method: 'DELETE',
        headers,
      })
    ).status,
    409,
  );
  const form = await resource('lead_forms', 'inquiry', {
    buttonText: 'Ask us',
    confirmation: 'Received test inquiry',
    details: d({
      leadFields: [
        { key: 'firstName', label: 'Name', display: 'Required', width: '50%' },
        { key: 'email', label: 'Email', display: 'Required', width: '50%' },
      ],
    }),
  });
  assert.equal((await fetch(base + '/inquiry/' + form.id)).status, 200);
  const input = {
    formId: form.id,
    requestId: randomUUID(),
    values: { firstName: 'QA', email: 'qa@example.com' },
    answers: {},
  };
  let receipt = await ok('inquiry', input, false);
  assert.equal(receipt.message, 'Received test inquiry');
  await ok('inquiry', input, false);
  eventIds.push(input.requestId);
  j = await ok('crm');
  assert.equal(j.events.filter((e) => e.id === input.requestId).length, 1);
  assert.equal(j.events.find((e) => e.id === input.requestId).status, 'lead');
  assert.ok(
    (
      await call(
        'inquiry',
        {
          ...input,
          requestId: randomUUID(),
          values: { firstName: 'No email' },
        },
        false,
      )
    ).status >= 400,
  );
  const q = await resource('questionnaires', 'questions', {
    body: 'Choose',
    details: d({
      fields: [
        {
          id: 'question1',
          label: 'Choose',
          type: 'Dropdown',
          required: true,
          options: ['One', 'Two'],
          tab: 'General',
          hint: '',
          placeholder: '',
          repeat: false,
          timeline: false,
          conditionField: '',
          conditionValue: '',
        },
      ],
    }),
  });
  j = await ok('manage', {
    action: 'apply_templates',
    templateId: q.id,
    eventIds: [input.requestId],
    sync: false,
  });
  const question = j.events.find((e) => e.id === input.requestId).operations
    .questions[0];
  assert.equal(question.type, 'Dropdown');
  await ok('manage', {
    action: 'save_planning',
    eventId: input.requestId,
    answers: { [question.id]: 'Two' },
    finalized: true,
  });
  assert.ok(
    (
      await call('manage', {
        action: 'apply_templates',
        templateId: q.id,
        eventIds: [input.requestId],
        sync: true,
      })
    ).status >= 400,
  );
  await ok('manage', {
    action: 'save_planning',
    eventId: input.requestId,
    finalized: false,
  });
  j = await ok('manage', {
    action: 'apply_templates',
    templateId: q.id,
    eventIds: [input.requestId],
    sync: true,
  });
  assert.equal(
    j.events.find((e) => e.id === input.requestId).operations.questions[0]
      .answer,
    'Two',
  );
  assert.equal(
    (await fetch(base + '/gallery/' + initial.business.id + '?kind=backdrops'))
      .status,
    200,
  );
  console.log(
    'PASS: owner resource CRUD, atomic bulk edits, scope ownership, category duplication, media permissions/references, lead forms and idempotent submissions, typed questionnaires, finalize/reopen/sync and galleries.',
  );
} finally {
  if (eventIds.length)
    await ok('sales', {
      action: 'event_lifecycle',
      ids: eventIds,
      lifecycle: 'Deleted',
    });
  const current = await ok('crm');
  for (const id of created.reverse()) {
    const r = current.resources.find((r) => r.id === id);
    if (r) await call('manage', { action: 'delete_resource', id });
  }
  if (mediaId)
    await fetch(base + '/api/media?id=' + mediaId, {
      method: 'DELETE',
      headers,
    });
}
