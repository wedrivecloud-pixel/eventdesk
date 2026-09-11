import assert from 'node:assert/strict';
const base = 'http://localhost:3000',
  h = { Cookie: '__sites_local_auth=1', 'Content-Type': 'application/json' };
async function call(body, path = 'crm') {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: h,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const initial = (await call()).data;
assert.ok(initial.business);
async function ok(body, path = 'crm') {
  const r = await call(body, path);
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
}
const suffix = Date.now();
const activeFlex = initial.resources.filter(
  (r) => r.kind === 'flex' && !r.archived,
);
try {
  for (const r of activeFlex)
    await ok(
      { action: 'archive_resource', id: r.id, archived: true },
      'manage',
    );
  await ok(
    {
      action: 'save_settings',
      group: 'pricing',
      data: {
        taxLabel: 'Tax',
        taxRate: 0,
        travelBase: 0,
        freeMiles: 0,
        mileRate: 0,
      },
    },
    'manage',
  );
  await ok(
    {
      action: 'save_settings',
      group: 'availability',
      data: { dailyLimit: 0, noticeDays: 0, blackoutDates: '' },
    },
    'manage',
  );
  const d = await ok(
    {
      action: 'save_resource',
      kind: 'addons',
      name: 'Included prints ' + suffix,
      data: { price: 100, description: 'Test prints' },
    },
    'manage',
  );
  const addon = d.resources.find((x) => x.name === 'Included prints ' + suffix);
  const body = {
    action: 'save_package',
    name: 'Package settings test ' + suffix,
    service: 'Photobooths',
    price: 80000,
    duration: '4 hours',
    description: 'Package settings validation',
    settings: {
      group: 'Photo Booth Collection',
      status: 'Public',
      includedMinutes: 240,
      minMinutes: 240,
      maxMinutes: 360,
      extraHours: true,
      extraRate: 150,
      increment: 30,
      depositMode: 'Flat rate',
      depositValue: 150,
      days: [6],
      startTime: '09:00',
      endTime: '23:00',
      picker: 'Predefined slots',
      slots: '10:00, 14:00, 18:00',
      includedAddonIds: [addon.id],
      subheader: 'Everything included',
      requiredStaff: 0,
    },
  };
  let data = await ok(body);
  let p = data.packages.find((x) => x.name === body.name);
  assert.equal(p.settings.extraRate, 150);
  const event = {
    action: 'save_event',
    title: 'Package schedule test ' + suffix,
    client: 'Local Test',
    email: 'test@example.com',
    date: '2027-06-12',
    time: '14:00',
    packageIds: [p.id],
    packageSelections: { [p.id]: { minutes: 300, units: 1 } },
  };
  data = await ok(event);
  const e = data.events.find((x) => x.title === event.title);
  assert.equal(e.items[0].price, 95000);
  assert.equal(e.total, 95000);
  assert.equal(e.deposit, 15000);
  assert.equal(e.operations.quote.extras[0].price, 0);
  for (const patch of [
    { date: '2027-06-13' },
    { time: '14:30' },
    { time: '18:00', packageSelections: { [p.id]: { minutes: 360 } } },
    { packageSelections: { [p.id]: { minutes: 270.5 } } },
    { packageSelections: { [p.id]: { minutes: 400 } } },
  ])
    assert.equal(
      (await call({ ...event, ...patch })).status,
      400,
      JSON.stringify(patch),
    );
  await ok({
    ...body,
    id: p.id,
    price: 99900,
    settings: { ...body.settings, extraRate: 500, depositValue: 900 },
  });
  data = await ok({ ...event, id: e.id });
  assert.equal(
    data.events.find((x) => x.id === e.id).total,
    95000,
    'Existing quote rate snapshot',
  );
  data = await ok({
    ...event,
    id: e.id,
    packageSelections: { [p.id]: { minutes: 330 } },
  });
  assert.equal(
    data.events.find((x) => x.id === e.id).total,
    102500,
    'Edited duration uses original rate',
  );
  await ok({
    ...body,
    id: p.id,
    settings: { ...body.settings, status: 'Disabled' },
  });
  assert.equal((await call(event)).status, 400);
  await ok({
    ...body,
    id: p.id,
    settings: { ...body.settings, status: 'Private' },
  });
  assert.equal((await call({ ...event, bookingPreview: true })).status, 400);
  await ok(event);
  assert.equal(
    (
      await call({
        ...body,
        id: p.id,
        settings: { ...body.settings, minMinutes: 500 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call({
        ...body,
        id: p.id,
        settings: { ...body.settings, includedAddonIds: ['foreign-resource'] },
      })
    ).status,
    400,
  );
  await ok({
    ...body,
    id: p.id,
    settings: {
      ...body.settings,
      status: 'Public',
      unitMode: 'Per unit',
      unitLabel: 'guest',
      minUnits: 2,
      maxUnits: 5,
      depositMode: 'Percentage',
      depositValue: 50,
    },
  });
  data = await ok({
    ...event,
    title: 'Units test ' + suffix,
    packageSelections: { [p.id]: { minutes: 240, units: 3 } },
  });
  const unit = data.events.find((x) => x.title === 'Units test ' + suffix);
  assert.equal(unit.total, 240000);
  assert.equal(unit.deposit, 120000);
  assert.equal(
    (
      await call({
        ...event,
        packageSelections: { [p.id]: { minutes: 240, units: 8 } },
      })
    ).status,
    400,
  );
  await ok({
    ...body,
    id: p.id,
    settings: {
      ...body.settings,
      requiredStaff: 2,
      requireBackdrop: true,
      allowSkipBackdrop: false,
    },
  });
  data = await ok({ ...event, title: 'Staff requirements ' + suffix });
  const staffed = data.events.find(
    (x) => x.title === 'Staff requirements ' + suffix,
  );
  await ok({ action: 'advance_event', id: staffed.id, status: 'proposal' });
  let denied = await call({
    action: 'advance_event',
    id: staffed.id,
    status: 'confirmed',
  });
  assert.equal(denied.status, 400);
  assert.match(denied.data.error, /backdrop/);
  await ok({
    ...body,
    id: p.id,
    settings: { ...body.settings, requiredStaff: 2 },
  });
  data = await ok({ ...event, title: 'Staff only ' + suffix });
  const staffOnly = data.events.find((x) => x.title === 'Staff only ' + suffix);
  await ok({ action: 'advance_event', id: staffOnly.id, status: 'proposal' });
  denied = await call({
    action: 'advance_event',
    id: staffOnly.id,
    status: 'confirmed',
  });
  assert.match(denied.data.error, /staff/);
  // Real R2 writes and owner-scoped image operations.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
    'base64',
  );
  async function img(method, id, bytes = png, auth = true, pid = p.id) {
    const r = await fetch(
      base + '/api/package-images?package=' + pid + (id ? '&id=' + id : ''),
      {
        method,
        headers: {
          ...(auth ? { Cookie: h.Cookie } : {}),
          'Content-Type': 'image/png',
        },
        ...(method === 'PUT' ? { body: bytes } : {}),
      },
    );
    return {
      status: r.status,
      data: r.headers.get('content-type')?.includes('json')
        ? await r.json()
        : await r.text(),
    };
  }
  let r = await img('PUT');
  assert.equal(r.status, 200, JSON.stringify(r));
  const first = r.data.images[0];
  r = await img('PUT');
  assert.equal(r.data.images.length, 2);
  const second = r.data.images.find((x) => x.id !== first.id);
  r = await img('PATCH', second.id);
  assert.equal(r.data.images[0].id, second.id);
  assert.equal(r.data.images[0].is_primary, 1);
  const read = await fetch(base + '/api/package-images?id=' + first.id, {
    headers: { Cookie: h.Cookie },
  });
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), png);
  assert.equal(
    (await fetch(base + '/api/package-images?id=' + first.id)).status,
    404,
  );
  assert.equal(
    (await img('PUT', undefined, Buffer.from('<svg>bad</svg>'))).status,
    400,
  );
  assert.equal(
    (await img('PUT', undefined, Buffer.alloc(5 * 1024 * 1024 + 1))).status,
    413,
  );
  assert.equal(
    (await img('PUT', undefined, png, true, 'foreign-package')).status,
    404,
  );
  assert.equal(
    (await img('DELETE', first.id, undefined, true, 'foreign-package')).status,
    404,
  );
  r = await img('DELETE', second.id);
  assert.equal(r.data.images.length, 1);
  assert.equal(r.data.images[0].is_primary, 1);
  assert.equal(
    (
      await fetch(base + '/api/package-images?id=' + second.id, {
        headers: { Cookie: h.Cookie },
      })
    ).status,
    404,
  );
  data = (await call()).data;
  assert.equal(data.packages.find((x) => x.id === p.id).images[0].id, first.id);
} finally {
  // Restore pricing and availability even when an assertion fails.
  await ok(
    { action: 'save_settings', group: 'pricing', data: initial.settings },
    'manage',
  );
  await ok(
    { action: 'save_settings', group: 'availability', data: initial.settings },
    'manage',
  );
  for (const r of activeFlex)
    await ok(
      { action: 'archive_resource', id: r.id, archived: false },
      'manage',
    );
}
console.log(
  'PASS: package groups, visibility, extra-hour/unit pricing, deposit overrides, duration/weekday/slot validation, included add-ons, snapshot stability, staffing/backdrop confirmation, R2 upload/primary/removal, image limits and tenant isolation.',
);
