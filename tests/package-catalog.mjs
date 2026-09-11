import assert from 'node:assert/strict';
const base = 'http://localhost:3000',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  },
  suffix = Date.now();
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
  business = initial.business,
  service = 'Catalog test ' + suffix,
  second = 'Catalog second ' + suffix;
async function page(path, auth = false) {
  const r = await fetch(base + path, {
    redirect: 'manual',
    headers: auth ? headers : {},
  });
  return {
    status: r.status,
    location: r.headers.get('location'),
    html: await r.text(),
  };
}
const path =
  '/reservation/start?' + new URLSearchParams({ business: business.id });
async function pkg(name, price, status = 'Public', whichService = service) {
  const d = await admin('crm', {
    action: 'save_package',
    name: name + ' ' + suffix,
    service: whichService,
    price,
    duration: '4 hours',
    description: 'Package description ' + name,
    settings: {
      status,
      group: 'Collection ' + suffix,
      includedMinutes: 240,
      minMinutes: 180,
      maxMinutes: 300,
      increment: 60,
      extraHours: true,
      extraRate: 150,
    },
  });
  return d.packages.find((p) => p.name === name + ' ' + suffix);
}
try {
  await admin('packages', { action: 'save_service', name: service });
  await admin('packages', { action: 'save_service', name: second });
  const bronze = await pkg('Catalog Bronze', 40000),
    silver = await pkg('Catalog Silver', 60000),
    gold = await pkg('Catalog Gold', 80000),
    privatePackage = await pkg('PRIVATE_HIDDEN', 10000, 'Private'),
    disabled = await pkg('DISABLED_HIDDEN', 10000, 'Disabled'),
    dj = await pkg('Other service package', 100000, 'Public', second);
  await admin('packages', {
    action: 'sort_group',
    service,
    group: 'Collection ' + suffix,
    sort: 'Custom order',
    ids: [gold.id, bronze.id, silver.id, privatePackage.id, disabled.id],
  });
  await admin('manage', {
    action: 'save_settings',
    group: 'booking',
    data: {
      headline: 'Choose your celebration ' + suffix,
      subheading: 'All our event packages',
      cta: 'Ask about this event',
      multiplePackages: true,
    },
  });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOfoAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await fetch(
    base + '/api/package-images?package=' + bronze.id,
    {
      method: 'PUT',
      headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
      body: png,
    },
  );
  assert.equal(upload.status, 200);
  const photo = (await upload.json()).images[0];
  let result = await page(path);
  assert.equal(result.status, 200);
  const html = result.html;
  for (const value of [
    bronze.name,
    silver.name,
    gold.name,
    dj.name,
    'Choose your celebration ' + suffix,
    'All our event packages',
    'Ask about this event', // The saved booking CTA is used by the public catalog.
    'Collection ' + suffix,
    '$400.00',
    '$600.00',
    '$800.00',
    '$150.00',
    photo.id,
  ])
    assert.ok(html.includes(value), 'Missing ' + value);
  for (const value of [
    privatePackage.id,
    privatePackage.name,
    disabled.id,
    disabled.name,
    'foreign-package',
    'Foreign Event',
    'Other Client',
    'owner_id',
    'requiredStaff',
    'discountRule',
  ])
    assert.ok(!html.includes(value), 'Leaked ' + value);
  assert.ok(html.indexOf(gold.name) < html.indexOf(bronze.name));
  assert.ok(
    html.indexOf(bronze.name) < html.indexOf(silver.name),
    'Saved custom order',
  );
  assert.ok(
    html.includes('/book/' + bronze.id),
    'Choose links to exact package',
  );
  const selected = await page('/book/' + bronze.id);
  assert.equal(selected.status, 200);
  assert.ok(selected.html.includes('View all packages'));
  assert.ok(selected.html.includes(business.id));
  assert.ok(!selected.html.includes(silver.name));
  assert.equal(
    (await page('/book/' + privatePackage.id)).status,
    200,
    'Private still supports direct link',
  );
  result = await page('/reservation/start');
  assert.equal(result.status, 307);
  assert.equal(new URL(result.location, base).pathname, '/sign-in');
  assert.equal(
    new URL(result.location, base).searchParams.get('return_to'),
    '/reservation/start',
  );
  result = await page('/reservation/start', true);
  assert.equal(result.status, 307);
  assert.equal(result.location, path);
  for (const suffix of [
    '?business=missing',
    '?business=',
    '?business=' + business.id + '&business=foreign-business',
  ])
    assert.equal(
      (await page('/reservation/start' + suffix)).status,
      404,
      suffix,
    );
  const foreign = await page('/reservation/start?business=foreign-business');
  assert.ok(!foreign.html.includes(bronze.name));
  await admin('crm', {
    action: 'save_business',
    ...business,
    services: [...business.services, second],
  });
  result = await page(path);
  assert.ok(!result.html.includes(bronze.name));
  assert.ok(result.html.includes(dj.name), 'Disabled service excluded');
  await admin('crm', {
    action: 'save_business',
    ...business,
    services: ['Empty catalog ' + suffix],
  });
  result = await page(path);
  assert.equal(result.status, 200);
  assert.ok(result.html.includes('No packages are available online yet'));
  assert.ok(!result.html.includes(bronze.name));
  assert.ok(result.html.includes(business.email));
  assert.equal(
    (await fetch(base + '/api/crm')).status,
    401,
    'Owner APIs still require sign-in',
  );
  console.log(
    'PASS: all-public-package catalog, photos and prices, saved groups/order, exact-package selection and return link, custom headings, business isolation, private/disabled/service filtering, empty states and safe owner redirect.',
  );
} finally {
  await admin('crm', { action: 'save_business', ...business });
  await admin('manage', {
    action: 'save_settings',
    group: 'booking',
    data: initial.settings,
  });
}
