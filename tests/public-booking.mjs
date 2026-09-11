import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = 'http://localhost:3000',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  };
async function admin(path, body) {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  return d;
}
const initial = await admin('crm'),
  suffix = Date.now(),
  service = initial.business.services[0];
const activeFlex = initial.resources.filter(
  (x) => x.kind === 'flex' && !x.archived,
);
const setting = (group, data) =>
  admin('manage', { action: 'save_settings', group, data });
const archive = (id, archived) =>
  admin('manage', { action: 'archive_resource', id, archived });
async function resource(kind, name, data) {
  const d = await admin('manage', {
    action: 'save_resource',
    kind,
    name: name + ' ' + suffix,
    data,
  });
  return d.resources.find((x) => x.name === name + ' ' + suffix);
}
let p, body, selection, request;
async function call(patch = {}, extraHeaders = {}) {
  const r = await fetch(base + '/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({
      action: 'quote',
      packageId: p.id,
      ...selection,
      ...patch,
    }),
  });
  return {
    status: r.status,
    data: r.headers.get('content-type')?.includes('json')
      ? await r.json()
      : { error: await r.text() },
  };
}
const okay = async (patch = {}, extra) => {
  const r = await call(patch, extra);
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
};
async function save(patch = {}) {
  const d = await admin('crm', { ...body, id: p?.id, ...patch });
  p = d.packages.find((x) => x.name === body.name);
  return p;
}
try {
  await setting('pricing', {
    taxLabel: 'Sales tax',
    taxRate: 10,
    travelBase: 10,
    freeMiles: 10,
    mileRate: 2,
  });
  await setting('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: '',
  });
  for (const r of activeFlex) await archive(r.id, true);
  const addon = await resource('addons', 'Public test extra', {
    price: 50,
    description: 'Optional upgrade',
  });
  const included = await resource('addons', 'Public test included', {
    price: 100,
    description: 'Included prints',
  });
  const backdrop = await resource('backdrops', 'Public test backdrop', {
    price: 25,
    description: 'Gold backdrop',
  });
  const discount = await resource('discounts', 'Private coupon', {
    code: 'PUBLIC' + suffix,
    mode: 'Percentage',
    amount: 10,
    description: 'PRIVATE_DISCOUNT_NOTES_' + suffix,
  });
  body = {
    action: 'save_package',
    name: 'Public booking package ' + suffix,
    service,
    price: 40000,
    duration: '4 hours',
    description: 'Customer package description',
    settings: {
      status: 'Public',
      includedMinutes: 240,
      minMinutes: 240,
      maxMinutes: 360,
      increment: 30,
      extraHours: true,
      extraRate: 150,
      depositMode: 'Flat rate',
      depositValue: 100,
      startTime: '09:00',
      endTime: '22:00',
      picker: 'Predefined slots',
      slots: '09:00, 14:00, 19:00',
      includedAddonIds: [included.id],
      requiredStaff: 1,
    },
  };
  await save();
  selection = {
    date: '2027-11-13',
    time: '14:00',
    minutes: 300,
    units: 1,
    addonIds: [addon.id],
    backdropId: backdrop.id,
    discountCode: 'PUBLIC' + suffix,
  };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await fetch(base + '/api/package-images?package=' + p.id, {
    method: 'PUT',
    headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(upload.status, 200);
  const image = (await upload.json()).images[0];
  const publicImage = await fetch(
    base + '/api/booking/image?package=' + p.id + '&image=' + image.id,
  );
  assert.equal(publicImage.status, 200);
  assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), png);
  assert.equal(
    (
      await fetch(
        base + '/api/booking/image?package=foreign-package&image=' + image.id,
      )
    ).status,
    404,
  );
  assert.equal(
    (await fetch(base + '/api/package-images?id=' + image.id)).status,
    404,
  );
  const page = await fetch(base + '/book/' + p.id);
  assert.equal(page.status, 200);
  const html = await page.text();
  for (const expected of [
    p.name,
    'How can we reach you?',
    'No payment collected',
    image.id,
  ])
    assert.ok(html.includes(expected), expected);
  for (const secret of [
    'PRIVATE_DISCOUNT_NOTES_' + suffix,
    discount.id,
    'owner_id',
    'requiredStaff',
    'discountRule',
    'Other Client',
    'Foreign Event',
  ])
    assert.ok(!html.includes(secret), 'Public HTML leaked ' + secret);
  const slots = await fetch(
    base +
      '/api/booking?' +
      new URLSearchParams({
        package: p.id,
        date: selection.date,
        minutes: '300',
      }),
  );
  assert.deepEqual(await slots.json(), {
    available: true,
    times: ['09:00', '14:00'],
    slots: [
      { time: '09:00', label: '09:00', minutes: 300 },
      { time: '14:00', label: '14:00', minutes: 300 },
    ],
  });
  const q = await okay();
  assert.equal(q.packagePrice, 55000);
  assert.equal(q.discount, 6250);
  assert.equal(q.tax, 5625);
  assert.equal(q.total, 62875);
  assert.equal(q.deposit, 10000);
  assert.equal(q.extras.find((x) => x.name === included.name).price, 0);
  for (const k of [
    'settings',
    'rules',
    'discountRule',
    'business_id',
    'addonIds',
  ])
    assert.ok(!(k in q));
  const forged = await okay({
    businessId: 'foreign-business',
    total: 1,
    deposit: 0,
    status: 'confirmed',
    price: 1,
    discountId: 'foreign-resource',
    miles: -100,
  });
  assert.equal(forged.total, q.total);
  for (const patch of [
    { addonIds: ['foreign-resource'] },
    { backdropId: 'foreign-resource' },
    { discountCode: 'INVALID' },
    { time: '14:30' },
    { time: '19:00' },
    { time: '' },
    { minutes: 271 },
    { units: NaN },
    { date: '2020-01-01' },
  ]) {
    if ('units' in patch) continue; // A package without per-unit pricing always uses one unit.
    assert.equal((await call(patch)).status, 400, JSON.stringify(patch));
  }
  request = {
    action: 'submit',
    requestId: randomUUID(),
    firstName: 'Local',
    lastName: 'Client',
    email: 'local-booking@example.com',
    phone: '555-0100',
    title: 'Anonymous request ' + suffix,
    venue: 'Local test venue',
    notes: 'Please call about setup.',
    acknowledged: true,
    quoteToken: q.token,
  };
  assert.equal(
    (await call(request, { Origin: 'https://different.example' })).status,
    403,
  );
  assert.equal(
    (await call({ ...request, companyWebsite: 'bot.example' })).status,
    400,
  );
  assert.equal((await call({ ...request, acknowledged: false })).status, 400);
  const results = await Promise.all([call(request), call(request)]);
  for (const r of results) {
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.status, 'pending');
    assert.equal(r.data.reference, request.requestId);
    assert.deepEqual(Object.keys(r.data).sort(), [
      'message',
      'reference',
      'status',
    ]);
  }
  let data = await admin('crm'),
    matches = data.events.filter((e) => e.id === request.requestId);
  assert.equal(matches.length, 1);
  const e = matches[0];
  assert.equal(e.status, 'lead');
  assert.equal(e.source, 'Online booking request');
  assert.equal(e.total, q.total);
  assert.equal(e.deposit, q.deposit);
  assert.equal(e.items[0].id, p.id);
  assert.equal(e.operations.customerRequest.approvalRequired, true);
  assert.equal(data.payments.filter((x) => x.event_id === e.id).length, 0);
  assert.equal(
    (await call({ ...request, notes: 'A different request' })).status,
    409,
  );
  await save({ price: 50000 });
  assert.equal(
    (await call({ ...request, requestId: randomUUID() })).data.code,
    'QUOTE_CHANGED',
  );
  assert.equal(
    (await call(request)).status,
    200,
    'Retry after price changes returns the original receipt',
  );
  const newQuote = await okay();
  assert.equal(newQuote.packagePrice, 65000);
  await save();
  await setting('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: selection.date,
  });
  assert.equal((await call()).status, 400);
  await setting('availability', {
    dailyLimit: 0,
    noticeDays: 365,
    blackoutDates: '',
  });
  assert.equal(
    (
      await call({
        date: new Intl.DateTimeFormat('en-CA', {
          timeZone: initial.settings.timezone,
        }).format(new Date()),
      })
    ).status,
    400,
  );
  await setting('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: '',
  });
  await save({
    settings: {
      ...body.settings,
      requireBackdrop: true,
      allowSkipBackdrop: false,
    },
  });
  assert.equal((await call({ backdropId: '' })).status, 400);
  await save({
    settings: {
      ...body.settings,
      unitMode: 'Per unit',
      minUnits: 2,
      maxUnits: 4,
      unitLabel: 'guest',
    },
  });
  assert.equal((await call({ units: 1 })).status, 400);
  assert.equal((await okay({ units: 3 })).packagePrice, 165000);
  await save({
    settings: {
      ...body.settings,
      startTime: '00:00',
      endTime: '23:59',
      picker: 'Minimal',
      slots: '',
    },
  });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: initial.settings.timezone,
  }).format(new Date());
  assert.equal((await call({ date: today, time: '00:00' })).status, 400);
  await save({
    settings: { ...body.settings, status: 'Private', dateMode: 'Date Only' },
  });
  assert.equal((await fetch(base + '/book/' + p.id)).status, 200);
  assert.equal((await call({ time: '' })).status, 200);
  await save({ settings: { ...body.settings, status: 'Disabled' } });
  assert.equal((await fetch(base + '/book/' + p.id)).status, 404);
  assert.equal((await call()).status, 404);
  assert.equal(
    (
      await fetch(
        base + '/api/booking/image?package=' + p.id + '&image=' + image.id,
      )
    ).status,
    404,
  );
  await save();
  const otherServices = initial.business.services.filter((s) => s !== service);
  if (!otherServices.length) otherServices.push('DJs');
  await admin('crm', {
    action: 'save_business',
    ...initial.business,
    services: otherServices,
  });
  assert.equal((await fetch(base + '/book/' + p.id)).status, 404);
  await admin('crm', { action: 'save_business', ...initial.business });
  assert.equal((await fetch(base + '/book/missing-package')).status, 404);
  for (const path of ['crm', 'manage', 'packages']) {
    const r = await fetch(base + '/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(r.status, 401, path);
  }
  assert.equal((await fetch(base + '/api/crm')).status, 401);
  assert.equal(
    (await fetch(base + '/proposal/' + e.id, { redirect: 'manual' })).status,
    404, // Public proposals require a valid share token; no record enumeration.
  );
  const root = await (await fetch(base)).text();
  assert.ok(!root.includes(e.email));
  assert.ok(!root.includes(e.title));
  // A lead does not consume capacity. A confirmed local fixture does.
  const capacityBody = {
    ...body,
    name: 'Capacity fixture ' + suffix,
    settings: { ...body.settings, dateMode: 'Date Only', requiredStaff: 0 },
  };
  data = await admin('crm', capacityBody);
  const capacityPackage = data.packages.find(
    (x) => x.name === capacityBody.name,
  );
  data = await admin('crm', {
    action: 'save_event',
    title: 'Confirmed local capacity ' + suffix,
    client: 'Local Test',
    email: 'capacity@example.com',
    date: selection.date,
    packageIds: [capacityPackage.id],
  });
  const capacityEvent = data.events.find(
    (x) => x.title === 'Confirmed local capacity ' + suffix,
  );
  await admin('crm', {
    action: 'advance_event',
    id: capacityEvent.id,
    status: 'proposal',
  });
  await admin('crm', {
    action: 'advance_event',
    id: capacityEvent.id,
    status: 'confirmed',
  });
  await setting('availability', {
    dailyLimit: 1,
    noticeDays: 0,
    blackoutDates: '',
  });
  assert.equal((await call()).status, 400);
  await setting('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: '',
  });
  // Rate limiting creates no events for failed/stale quotes. Test last because the window persists.
  let limited = false;
  for (let i = 0; i < 42; i++) {
    const r = await call({
      ...request,
      requestId: randomUUID(),
      quoteToken: 'invalid',
    });
    if (r.status === 429) {
      limited = true;
      break;
    }
    assert.equal(r.status, 409, JSON.stringify(r));
  }
  assert.ok(limited, 'Submission rate limit');
  console.log(
    'PASS: anonymous package page and photos, no CRM leakage, server pricing, extras and coupons, slots and date rules, approval-only leads, idempotent concurrent retries, changed-price review, tenant scope, disabled packages/services, private API protection, capacity and rate limits.',
  );
} finally {
  for (const group of ['pricing', 'availability'])
    await setting(group, initial.settings);
  for (const r of activeFlex) await archive(r.id, false);
  await admin('crm', { action: 'save_business', ...initial.business });
}
