import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = 'http://localhost:3000',
  tag = 'Manage booking QA ' + Date.now(),
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
  events = [];
let p;
const details = (d = {}) =>
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
    ...d,
  });
async function resource(kind, name, data) {
  const j = await ok('manage', {
      action: 'save_resource',
      kind,
      name: tag + ' ' + name,
      data,
    }),
    r = j.resources.find((r) => r.kind === kind && r.name === tag + ' ' + name);
  created.push(r.id);
  return r;
}
const eventBody = (name, time = '10:00', more = {}) => ({
  action: 'save_event',
  title: tag + ' ' + name,
  client: 'Test customer',
  email: 'test@example.com',
  phone: '123',
  date: '2028-02-10',
  time,
  venue: 'Test venue',
  packageIds: [p.id],
  ...more,
});
async function event(name, time, more) {
  const j = await ok('crm', eventBody(name, time, more)),
    e = j.events.find((e) => e.title === tag + ' ' + name);
  events.push(e.id);
  return e;
}
try {
  await ok('manage', {
    action: 'save_settings',
    group: 'availability',
    data: {
      ...initial.settings,
      dailyLimit: 0,
      noticeDays: 0,
      blackoutDates: '',
    },
  });
  const j = await ok('crm', {
    action: 'save_package',
    name: tag,
    service: initial.business.services[0],
    price: 10000,
    duration: '2 hr',
    description: 'Local test',
    settings: {
      includedMinutes: 120,
      minMinutes: 120,
      maxMinutes: 120,
      availabilityMode: 'Every day',
      requiredStaff: 0,
      status: 'Public',
    },
  });
  p = j.packages.find((p) => p.name === tag);
  const a = await resource('addons', 'extra', {
    price: 10,
    maxQuantity: 4,
    pricingMethod: 'Multiply by package hours',
    extensionMinutes: 30,
    details: details({ packageMode: 'selected', packageIds: [p.id] }),
  });
  const e = await event('first', '10:00', {
    addonIds: [a.id],
    addonQuantities: { [a.id]: 2 },
  });
  assert.equal(e.operations.quote.extras[0].price, 4000);
  assert.equal(e.items[0].extraMinutes, 60);
  const rule = await resource('inventory_rules', 'capacity', {
    capacity: 1,
    details: details({ packageMode: 'selected', packageIds: [p.id] }),
  });
  await ok('crm', { action: 'advance_event', id: e.id, status: 'proposal' });
  await ok('crm', { action: 'advance_event', id: e.id, status: 'confirmed' });
  const conflict = await event('conflict', '12:30');
  await ok('crm', {
    action: 'advance_event',
    id: conflict.id,
    status: 'proposal',
  });
  assert.ok(
    (
      await call('crm', {
        action: 'advance_event',
        id: conflict.id,
        status: 'confirmed',
      })
    ).status >= 400,
    'extension blocks overlapping capacity',
  );
  const later = await event('later', '14:00');
  await ok('crm', {
    action: 'advance_event',
    id: later.id,
    status: 'proposal',
  });
  await ok('crm', {
    action: 'advance_event',
    id: later.id,
    status: 'confirmed',
  });
  const discount = await resource('discounts', 'code', {
    code: tag.replaceAll(' ', '').slice(0, 70),
    mode: 'Fixed amount',
    amount: 5,
    maxRedemptions: 1,
    scope: 'Complete booking',
    details: details({ packageMode: 'selected', packageIds: [p.id] }),
  });
  const attempts = await Promise.all(
    ['couponA', 'couponB'].map((name) =>
      call('crm', eventBody(name, '08:00', { discountId: discount.id })),
    ),
  );
  assert.equal(
    attempts.filter((r) => r.status === 200).length,
    1,
    'one atomic redemption',
  );
  const current = await ok('crm');
  for (const e of current.events.filter((e) =>
    e.title.startsWith(tag + ' coupon'),
  ))
    events.push(e.id);
  assert.equal(
    current.events.filter((e) => e.title.startsWith(tag + ' coupon')).length,
    1,
    'rejected attempt leaves no orphan event',
  );
  const method = await resource('payment_methods', 'cashapp', {
    enabled: true,
    instructions: 'Pay through our agreed offline method',
    showInvoice: true,
  });
  await ok('manage', {
    action: 'record_payment',
    eventId: e.id,
    amount: 500,
    tip: 0,
    method: method.name,
    date: '2027-01-01',
    reference: 'QA',
  });
  const plan = await resource('payment_plans', 'plan', {
    planType: 'Deposit + monthly payments',
    splitCount: 3,
    enabled: true,
  });
  const planned = await ok('manage', {
    action: 'apply_payment_plan',
    eventId: e.id,
    planId: plan.id,
  });
  assert.equal(
    planned.events
      .find((x) => x.id === e.id)
      .operations.paymentPlan.schedule.reduce((n, p) => n + p.amount, 0),
    e.total,
  );
  const fileField = {
    id: 'file',
    label: 'Upload inspiration',
    type: 'File Upload Field',
    required: true,
    options: [],
    tab: 'General',
    hint: '',
    placeholder: '',
    repeat: false,
    timeline: false,
    conditionField: '',
    conditionValue: '',
  };
  const form = await resource('lead_forms', 'upload', {
    confirmation: 'Thanks',
    details: details({ fields: [fileField] }),
  });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
    'base64',
  );
  const up = await fetch(
    base +
      '/api/question-file?' +
      new URLSearchParams({
        formId: form.id,
        field: 'file',
        name: 'inspiration.png',
      }),
    { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png },
  );
  assert.equal(up.status, 200, await up.clone().text());
  const file = (await up.json()).id;
  assert.equal(
    (await fetch(base + '/api/question-file?id=' + file)).status,
    404,
  );
  assert.equal(
    (await fetch(base + '/api/question-file?id=' + file, { headers })).status,
    200,
  );
  const input = {
    formId: form.id,
    requestId: randomUUID(),
    values: { firstName: 'Test', email: 'test@example.com' },
    answers: { file },
  };
  await ok('inquiry', input, false);
  events.push(input.requestId);
  assert.ok(
    (
      await call(
        'inquiry',
        { ...input, requestId: randomUUID(), answers: { file: randomUUID() } },
        false,
      )
    ).status >= 400,
  );
  console.log(
    'PASS: owner extra quantities, extended scheduling, atomic shared capacity, concurrent coupon limits and rollback, custom payment recording, applied installment schedules, anonymous uploads with owner-only downloads and response-file ownership.',
  );
} finally {
  if (events.length)
    await ok('sales', {
      action: 'event_lifecycle',
      ids: events,
      lifecycle: 'Deleted',
    });
  for (const id of created.reverse())
    await call('manage', { action: 'delete_resource', id });
  if (p)
    await call('crm', {
      action: 'save_package',
      id: p.id,
      name: p.name,
      service: p.service,
      price: p.price,
      duration: p.duration,
      description: p.description,
      settings: { ...p.settings, status: 'Disabled' },
    });
  await ok('manage', {
    action: 'save_settings',
    group: 'availability',
    data: initial.settings,
  });
}
