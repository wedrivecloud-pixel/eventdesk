import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  'Content-Type': 'application/json',
};
async function crm(body) {
  const r = await fetch(base + '/api/crm', {
    method: body ? 'POST' : 'GET',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const suffix = Date.now();
const body = {
  action: 'save_package',
  name: 'Direct link package ' + suffix,
  service: 'Photobooths',
  price: 40000,
  duration: '4 hours',
  description: 'Direct link selection fixture',
  settings: { status: 'Private', dateMode: 'Date Only' },
};
let r = await crm(body);
assert.equal(r.status, 200);
const p = r.data.packages.find((x) => x.name === body.name);
const path = '/booking-preview?package=' + encodeURIComponent(p.id);
let page = await fetch(base + path, { headers });
assert.equal(page.status, 200);
let html = await page.text();
assert.ok(html.includes(p.name));
assert.ok(
  html.includes('duration &amp; quantity'),
  'Linked package must be selected on first render',
);
assert.ok(
  !html.includes('Wedding DJ'),
  'Direct link shows only the requested package',
);
page = await fetch(base + path, { redirect: 'manual' });
assert.equal(page.status, 307);
const location = new URL(page.headers.get('location'), base);
assert.equal(location.pathname, '/sign-in');
assert.equal(
  location.searchParams.get('return_to'),
  path,
  'Sign-in must preserve package target',
);
const e = {
  action: 'save_event',
  title: 'Direct link inquiry ' + suffix,
  client: 'Local Test',
  email: 'test@example.com',
  date: '2027-11-13',
  packageIds: [p.id],
  bookingPreview: true,
};
assert.equal(
  (await crm(e)).status,
  400,
  'Unlisted package must not be bookable from the general catalog',
);
r = await crm({ ...e, packageLinkId: p.id });
assert.equal(r.status, 200, JSON.stringify(r));
assert.equal(r.data.events.find((x) => x.title === e.title).items[0].id, p.id);
for (const id of ['foreign-package', 'missing-package']) {
  page = await fetch(base + '/booking-preview?package=' + id, { headers });
  assert.equal(page.status, 404);
}
assert.equal(
  (
    await crm({
      ...e,
      packageIds: ['foreign-package'],
      packageLinkId: 'foreign-package',
    })
  ).status,
  400,
  'Direct links cannot cross business ownership',
);
await crm({
  ...body,
  id: p.id,
  settings: { ...body.settings, status: 'Disabled' },
});
page = await fetch(base + path, { headers });
assert.equal(page.status, 404);
assert.equal((await crm({ ...e, packageLinkId: p.id })).status, 400);
await crm({
  ...body,
  id: p.id,
  settings: { ...body.settings, status: 'Public' },
});
page = await fetch(base + path, { headers });
assert.equal(page.status, 200);
page = await fetch(
  base + '/booking-preview?package=' + p.id + '&package=missing',
  { headers },
);
assert.equal(page.status, 404);
console.log(
  'PASS: direct package selection, single-package preview, sign-in return URL, public/unlisted access, disabled/missing IDs and cross-business isolation.',
);
