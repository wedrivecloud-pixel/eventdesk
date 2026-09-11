import assert from 'node:assert/strict';
import { managerGroups, orderedPackages } from '../lib/package-manager.ts';
const base = 'http://localhost:3000',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  },
  suffix = Date.now();
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
assert.equal(
  (
    await call(
      { action: 'save_service', name: 'Unauthorized' },
      'packages',
      false,
    )
  ).status,
  401,
);
const service = 'Manager QA ' + suffix;
let data = await ok({ action: 'save_service', name: service });
assert.ok(data.business.services.includes(service));
data = await ok({ action: 'save_group', service, name: 'Empty group' });
assert.ok(
  managerGroups(data, service).some(
    (g) => g.name === 'Empty group' && g.packages.length === 0,
  ),
);
async function pkg(name, price) {
  const d = await ok(
    {
      action: 'save_package',
      name: name + ' ' + suffix,
      service,
      price,
      duration: '2 hours',
      description: 'Manager fixture',
      settings: { group: 'Original group', dateMode: 'Date Only' },
    },
    'crm',
  );
  return d.packages.find((x) => x.name === name + ' ' + suffix);
}
const a = await pkg('Alpha', 40000),
  b = await pkg('Beta', 60000);
const eventBody = {
  action: 'save_event',
  title: 'Manager quote ' + suffix,
  client: 'Sample',
  email: 'test@example.com',
  date: '2028-06-17',
  packageIds: [a.id],
};
data = await ok(eventBody, 'crm');
const quote = data.events.find((x) => x.title === eventBody.title);
data = await ok({
  action: 'save_group',
  service,
  name: 'Main group',
  original: 'Original group',
  fromService: service,
});
assert.ok(
  data.packages
    .filter((p) => [a.id, b.id].includes(p.id))
    .every((p) => p.settings.group === 'Main group'),
);
data = await ok({
  action: 'bulk_packages',
  ids: [a.id, b.id],
  changes: {
    priceMode: 'Adjust by percent',
    priceValue: 10,
    status: 'Private',
  },
});
assert.equal(data.packages.find((p) => p.id === a.id).price, 44000);
assert.equal(data.packages.find((p) => p.id === b.id).price, 66000);
assert.equal(data.events.find((e) => e.id === quote.id).items[0].price, 40000);
let r = await call({
  action: 'bulk_packages',
  ids: [a.id, 'foreign-package'],
  changes: { priceMode: 'Set price', priceValue: 1 },
});
assert.equal(r.status, 400);
data = (await call(undefined, 'crm')).data;
assert.equal(
  data.packages.find((p) => p.id === a.id).price,
  44000,
  'Cross-business batch must not partially write',
);
r = await call({
  action: 'bulk_packages',
  ids: [b.id, a.id],
  changes: { priceMode: 'Adjust by amount', priceValue: -500 },
});
assert.equal(r.status, 400);
data = (await call(undefined, 'crm')).data;
assert.equal(
  data.packages.find((p) => p.id === b.id).price,
  66000,
  'Invalid price must reject entire batch',
);
data = await ok({
  action: 'sort_group',
  service,
  group: 'Main group',
  sort: 'Custom order',
  ids: [b.id, a.id],
});
assert.deepEqual(
  managerGroups(data, service)
    .find((g) => g.name === 'Main group')
    .packages.map((p) => p.id),
  [b.id, a.id],
);
assert.equal(
  (
    await call({
      action: 'sort_group',
      service,
      group: 'Main group',
      sort: 'Custom order',
      ids: ['foreign-package', a.id],
    })
  ).status,
  400,
);
data = await ok({
  action: 'sort_group',
  service,
  group: 'Main group',
  sort: 'Price: low to high',
});
assert.deepEqual(
  managerGroups(data, service)
    .find((g) => g.name === 'Main group')
    .packages.map((p) => p.id),
  [a.id, b.id],
);
data = await ok({
  action: 'reorder_groups',
  service,
  groups: ['Main group', 'Empty group'],
});
assert.equal(managerGroups(data, service)[0].name, 'Main group');
const service2 = service + ' new';
data = await ok({ action: 'save_service', name: service2, original: service });
assert.ok(!data.business.services.includes(service));
assert.equal(data.packages.find((p) => p.id === a.id).service, service2);
assert.equal(
  data.resources.find(
    (g) =>
      g.kind === 'package_groups' &&
      g.name === 'Empty group' &&
      g.data.service === service2,
  ).data.service,
  service2,
);
data = await ok({
  action: 'reorder_services',
  services: [service2, ...data.business.services.filter((s) => s !== service2)],
});
assert.equal(data.business.services[0], service2);
assert.equal(orderedPackages(data)[0].id, a.id);
data = await ok({
  action: 'bulk_packages',
  ids: [b.id],
  changes: { group: 'Empty group' },
});
assert.equal(
  data.packages.find((p) => p.id === b.id).settings.group,
  'Empty group',
);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
  'base64',
);
const upload = await fetch(base + '/api/package-images?package=' + a.id, {
  method: 'PUT',
  headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
  body: png,
});
assert.equal(upload.status, 200);
const originalImage = (await upload.json()).images[0];
data = await ok({ action: 'duplicate_package', id: a.id });
const copy = data.packages.find((p) => p.name === a.name + ' (copy)');
assert.ok(copy);
assert.equal(copy.settings.status, 'Private');
assert.equal(copy.price, 44000);
assert.equal(copy.images.length, 1);
assert.notEqual(copy.images[0].id, originalImage.id);
await fetch(
  base + '/api/package-images?package=' + a.id + '&id=' + originalImage.id,
  { method: 'DELETE', headers },
);
const image = await fetch(
  base + '/api/package-images?id=' + copy.images[0].id,
  { headers },
);
assert.equal(image.status, 200);
assert.deepEqual(
  Buffer.from(await image.arrayBuffer()),
  png,
  'Duplicated photo has independent stored bytes',
);
assert.equal(
  (await call({ action: 'duplicate_package', id: 'foreign-package' })).status,
  400,
);
data = await ok({
  action: 'bulk_packages',
  ids: [a.id, b.id, copy.id],
  changes: { status: 'Disabled' },
});
assert.ok(
  data.packages
    .filter((p) => [a.id, b.id, copy.id].includes(p.id))
    .every((p) => p.settings.status === 'Disabled'),
);
data = await ok({
  action: 'bulk_packages',
  ids: [a.id],
  changes: { status: 'Public' },
});
assert.equal(
  data.packages.find((p) => p.id === a.id).settings.status,
  'Public',
);
const badOrigin = await fetch(base + '/api/packages', {
  method: 'POST',
  headers: { ...headers, Origin: 'https://untrusted.example' },
  body: JSON.stringify({ action: 'save_service', name: 'bad' }),
});
assert.equal(badOrigin.status, 403);
console.log(
  'PASS: service/group creation and rename, empty groups, bulk prices and visibility, atomic rejection, quote snapshots, moving and saved service/group/package ordering, duplicate photos, disabled recovery, authentication and tenant isolation.',
);
