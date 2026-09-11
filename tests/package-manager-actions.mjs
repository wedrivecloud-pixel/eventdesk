import assert from 'node:assert/strict';
import { managerGroups } from '../lib/package-manager.ts';
const base = 'http://localhost:3000',
  suffix = Date.now(),
  service = 'Actions QA ' + suffix,
  copyService = service + ' copy';
const headers = {
  Cookie: '__sites_local_auth=1',
  'Content-Type': 'application/json',
};
async function call(body, path = 'packages', auth = true) {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function ok(body, path) {
  const r = await call(body, path);
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
}
const initial = await ok(undefined, 'crm');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
  'base64',
);
async function collectionImage(
  scope,
  method = 'PUT',
  body = png,
  auth = true,
  mime = 'image/png',
) {
  return fetch(base + '/api/catalog-image?' + new URLSearchParams(scope), {
    method,
    headers: {
      ...(auth ? { Cookie: headers.Cookie } : {}),
      'Content-Type': mime,
    },
    ...(method === 'PUT' ? { body } : {}),
  });
}
function record(data, kind, name, serviceName) {
  return data.resources.find(
    (r) =>
      r.kind === kind &&
      r.name === name &&
      (!serviceName || r.data.service === serviceName),
  );
}
async function status(path, expected, auth = false) {
  const r = await fetch(base + path, {
    headers: auth ? headers : {},
    redirect: 'manual',
  });
  assert.equal(r.status, expected, path);
  return r;
}
async function catalog(bid, scope) {
  const r = await status(
    '/reservation/start?' + new URLSearchParams({ business: bid, ...scope }),
    200,
  );
  return r.text();
}
const pricingKeys = [
  'taxLabel',
  'taxRate',
  'travelBase',
  'freeMiles',
  'mileRate',
];
try {
  let d = await ok({
    action: 'save_service',
    name: service,
    presentation: { showTitle: false, subheader: 'Service heading fixture' },
  });
  d = await ok({
    action: 'save_group',
    service,
    name: 'Main',
    presentation: { showTitle: false, subheader: 'Group heading fixture' },
  });
  await ok({ action: 'save_group', service, name: 'Empty' });
  assert.equal(
    (
      await call({
        action: 'save_service',
        name: service,
        original: service,
        presentation: { showTitle: true, subheader: '', imageId: 'foreign' },
      })
    ).status,
    400,
  );
  const packages = [];
  for (const [name, price, group, status] of [
    ['Alpha', 40000, 'Main', 'Public'],
    ['Beta', 60000, 'Main', 'Disabled'],
    ['Gamma', 20000, 'Elsewhere', 'Private'],
  ]) {
    d = await ok(
      {
        action: 'save_package',
        name: name + ' ' + suffix,
        service,
        price,
        duration: '2 hours',
        description: 'Action fixture',
        settings: { dateMode: 'Date Only', group, status },
      },
      'crm',
    );
    packages.push(d.packages.find((p) => p.name === name + ' ' + suffix));
  }
  const [a, b, c] = packages;
  const upload = await fetch(base + '/api/package-images?package=' + a.id, {
    method: 'PUT',
    headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(upload.status, 200);
  const sourceImage = (await upload.json()).images[0];
  assert.equal((await collectionImage({ service })).status, 200);
  assert.equal((await collectionImage({ service, group: 'Main' })).status, 200);
  assert.equal(
    (await collectionImage({ service }, 'PUT', png, false)).status,
    401,
  );
  assert.equal(
    (await collectionImage({ service: 'Foreign service' })).status,
    404,
  );
  assert.equal(
    (await collectionImage({ service, group: 'Does not exist' })).status,
    404,
  );
  assert.equal(
    (await collectionImage({ service }, 'PUT', '<svg/>', true, 'image/svg+xml'))
      .status,
    400,
  );
  assert.equal(
    (
      await collectionImage(
        { service },
        'PUT',
        new Uint8Array(5 * 1024 * 1024 + 1),
      )
    ).status,
    400,
  );
  d = await ok({
    action: 'sort_group',
    service,
    group: 'Main',
    sort: 'Custom order',
    ids: [b.id, a.id],
  });
  const sourceRecord = record(d, 'service_settings', service),
    groupRecord = record(d, 'package_groups', 'Main', service);
  await status('/api/catalog-image?id=' + sourceRecord.id, 200);
  await status('/api/catalog-image?id=' + groupRecord.id, 200);
  const eventBody = {
    action: 'save_event',
    title: 'Preserve history ' + suffix,
    client: 'Test Customer',
    email: 'qa@example.com',
    date: '2028-06-17',
    packageIds: [a.id],
  };
  d = await ok(eventBody, 'crm');
  const history = d.events.find((e) => e.title === eventBody.title),
    originalHistory = JSON.stringify(history);

  d = await ok({
    action: 'bulk_packages',
    ids: [a.id, b.id],
    changes: {
      settings: {
        depositMode: 'Flat rate',
        depositValue: 125,
        extraHours: true,
        extraRate: 50,
        dateMode: 'Date & Time',
        picker: 'Predefined slots',
        slots: '09:00, 14:00',
        startTime: '08:00',
        endTime: '20:00',
        days: [1, 2, 3, 4, 5, 6],
        showTitle: false,
        leadDays: 3,
        requiredStaff: 2,
        requireBackdrop: true,
        allowSkipBackdrop: true,
        bookingMode: 'Proposal request',
      },
    },
  });
  assert.equal(
    d.packages.find((p) => p.id === a.id).settings.depositValue,
    125,
  );
  assert.equal(
    d.packages.find((p) => p.id === b.id).settings.bookingMode,
    'Proposal request',
  );
  assert.equal(
    d.packages.find((p) => p.id === c.id).settings.depositMode,
    'Business default',
  );
  assert.equal(
    JSON.stringify(d.events.find((e) => e.id === history.id)),
    originalHistory,
  );
  const before = JSON.stringify(
    d.packages.filter((p) => [a.id, b.id].includes(p.id)),
  );
  for (const patch of [
    { depositMode: 'Percentage', depositValue: 101 },
    { days: [] },
    { includedMinutes: 9999 },
    { taxable: 'no' },
    { picker: 'Predefined slots', slots: 'bad' },
    { includedAddonIds: ['foreign-resource'] },
  ]) {
    assert.equal(
      (
        await call({
          action: 'bulk_packages',
          ids: [a.id, b.id],
          changes: { priceMode: 'Set price', priceValue: 1, settings: patch },
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await call({
        action: 'bulk_packages',
        ids: [a.id, 'foreign-package'],
        changes: { settings: { taxable: false } },
      })
    ).status,
    400,
  );
  assert.equal(
    JSON.stringify(
      (await ok(undefined, 'crm')).packages.filter((p) =>
        [a.id, b.id].includes(p.id),
      ),
    ),
    before,
    'Invalid bulk updates must be atomic',
  );
  d = await ok({ action: 'duplicate_service', service, name: copyService });
  const copies = d.packages.filter((p) => p.service === copyService);
  assert.equal(copies.length, 3);
  assert.ok(copies.every((p) => p.settings.status === 'Private'));
  const copyA = copies.find((p) => p.name === a.name),
    copyB = copies.find((p) => p.name === b.name);
  assert.equal(copyA.settings.depositValue, 125);
  assert.notEqual(copyA.images[0].id, sourceImage.id);
  assert.deepEqual(
    managerGroups(d, copyService)
      .find((g) => g.name === 'Main')
      .packages.map((p) => p.id),
    [copyB.id, copyA.id],
  );
  assert.ok(
    managerGroups(d, copyService).find(
      (g) => g.name === 'Empty' && !g.packages.length,
    ),
  );
  assert.equal(
    record(d, 'service_settings', copyService).data.subheader,
    'Service heading fixture',
  );
  const copyRecord = record(d, 'service_settings', copyService);
  await status('/api/catalog-image?id=' + copyRecord.id, 404);
  await status('/api/catalog-image?id=' + copyRecord.id, 200, true);
  assert.equal((await collectionImage({ service }, 'DELETE')).status, 200);
  await status('/api/catalog-image?id=' + sourceRecord.id, 404, true);
  await status('/api/catalog-image?id=' + copyRecord.id, 200, true);

  d = await ok({
    action: 'duplicate_group',
    service,
    group: 'Main',
    name: 'Copied group',
  });
  const copiedGroup = d.packages.filter(
    (p) => p.service === service && p.settings.group === 'Copied group',
  );
  assert.equal(copiedGroup.length, 2);
  assert.ok(copiedGroup.every((p) => p.settings.status === 'Private'));
  assert.equal(
    record(d, 'package_groups', 'Copied group', service).data.subheader,
    'Group heading fixture',
  );
  d = await ok({
    action: 'set_catalog_visibility',
    service,
    group: 'Main',
    status: 'Public',
  });
  assert.ok(
    d.packages
      .filter((p) => [a.id, b.id].includes(p.id))
      .every((p) => p.settings.status === 'Public'),
    'Includes previously disabled packages',
  );
  assert.equal(
    d.packages.find((p) => p.id === c.id).settings.status,
    'Private',
  );
  let html = await catalog(d.business.id, { service, group: 'Main' });
  assert.ok(html.includes(a.id) && html.includes(b.id));
  assert.ok(!html.includes(c.id) && !html.includes(copyA.id));
  assert.ok(
    html.includes('Group heading fixture') &&
      html.includes('Service heading fixture'),
  );
  assert.ok(html.includes('/api/catalog-image?id=' + groupRecord.id));
  await status(
    '/reservation/start?' +
      new URLSearchParams({
        business: d.business.id,
        service: 'Foreign service',
      }),
    404,
  );
  await status(
    '/reservation/start?' +
      new URLSearchParams({ business: d.business.id, group: 'Main' }),
    404,
  );
  await status(
    '/reservation/start?' +
      new URLSearchParams({
        business: d.business.id,
        service,
        group: 'Missing',
      }),
    404,
  );
  d = await ok({
    action: 'set_catalog_visibility',
    service: copyService,
    status: 'Public',
  });
  html = await catalog(d.business.id, { service: copyService });
  assert.ok(html.includes(copyA.id) && !html.includes(a.id));
  await status('/api/catalog-image?id=' + copyRecord.id, 200);

  await ok(
    {
      action: 'save_settings',
      group: 'pricing',
      data: {
        taxLabel: 'Test tax',
        taxRate: 10,
        travelBase: 0,
        freeMiles: 0,
        mileRate: 0,
      },
    },
    'manage',
  );
  await ok({
    action: 'bulk_packages',
    ids: [a.id, b.id],
    changes: {
      settings: {
        dateMode: 'Date Only',
        requiredStaff: 0,
        requireBackdrop: false,
      },
    },
  });
  await ok({
    action: 'bulk_packages',
    ids: [b.id],
    changes: { settings: { taxable: false } },
  });
  d = await ok(
    { ...eventBody, title: 'Mixed tax ' + suffix, packageIds: [a.id, b.id] },
    'crm',
  );
  const taxEvent = d.events.find((e) => e.title === 'Mixed tax ' + suffix),
    quote = taxEvent.operations.quote;
  assert.equal(
    quote.tax,
    Math.round(
      (quote.subtotal + quote.adjustment - quote.discount) * 0.4 * 0.1,
    ),
  );
  assert.equal(
    taxEvent.items.find((p) => p.id === b.id).packageSettings.taxable,
    false,
  );
  await ok({
    action: 'bulk_packages',
    ids: [b.id],
    changes: { settings: { taxable: true } },
  });
  assert.equal(
    (await ok(undefined, 'crm')).events.find((e) => e.id === taxEvent.id)
      .operations.quote.tax,
    quote.tax,
  );

  for (const body of [
    { action: 'delete_service', service, confirm: 'wrong' },
    { action: 'delete_group', service, group: 'Main', confirm: 'wrong' },
    { action: 'delete_packages', ids: [a.id], confirm: 'wrong' },
    {
      action: 'delete_packages',
      ids: [a.id, 'foreign-package'],
      confirm: 'DELETE',
    },
  ])
    assert.equal((await call(body)).status, 400);
  d = await ok({
    action: 'delete_group',
    service,
    group: 'Main',
    confirm: 'Main',
  });
  assert.ok(!d.packages.some((p) => [a.id, b.id].includes(p.id)));
  assert.ok(d.packages.some((p) => p.id === copyA.id));
  assert.equal(
    JSON.stringify(d.events.find((e) => e.id === history.id)),
    originalHistory,
  );
  await status('/api/package-images?id=' + sourceImage.id, 404, true);
  await status('/api/package-images?id=' + copyA.images[0].id, 200, true);
  await status('/api/catalog-image?id=' + groupRecord.id, 404, true);
  await status(
    '/api/catalog-image?id=' +
      record(d, 'package_groups', 'Copied group', service).id,
    200,
    true,
  );
  d = await ok({ action: 'delete_packages', ids: [c.id], confirm: 'DELETE' });
  assert.ok(!d.packages.some((p) => p.id === c.id));
  d = await ok({ action: 'delete_service', service, confirm: service });
  assert.ok(!d.business.services.includes(service));
  assert.ok(!d.packages.some((p) => p.service === service));
  assert.equal(
    JSON.stringify(d.events.find((e) => e.id === history.id)),
    originalHistory,
  );
  assert.ok(
    !d.resources.some(
      (r) =>
        (r.kind === 'package_groups' && r.data.service === service) ||
        (r.kind === 'service_settings' && r.name === service),
    ),
  );
  const foreign = await status('/api/crm', 200, true);
  assert.ok(
    !(await foreign.json()).packages.some((p) => p.id === 'foreign-package'),
  );
  console.log(
    'PASS: bulk settings and atomic validation; service/group cloning, empty groups, custom order, independent photos; images, presentation and scoped links; visibility; mixed taxable quotes; confirmed deletion and historical-data preservation; authentication and ownership.',
  );
} finally {
  for (const name of [service, copyService])
    await call({ action: 'delete_service', service: name, confirm: name });
  await ok(
    {
      action: 'save_settings',
      group: 'pricing',
      data: Object.fromEntries(
        pricingKeys.map((k) => [k, initial.settings[k]]),
      ),
    },
    'manage',
  );
}
