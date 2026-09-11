import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
const cookie = '__sites_local_auth=1';
async function call(body, auth = true) {
  const res = await fetch(base + '/api/crm', {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(auth ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}
assert.equal((await call(null, false)).status, 401);
assert.equal(
  (await call({ action: 'save_business', name: 'Bad' }, false)).status,
  401,
);
let r = await call({
  action: 'save_business',
  name: 'Sample Event Studio',
  email: 'hello@example.com',
  phone: '',
  services: ['Photobooths', 'DJs', 'Venues'],
});
assert.equal(r.status, 200, JSON.stringify(r));
r = await call({
  action: 'save_package',
  name: 'Photo Booth Gold',
  service: 'Photobooths',
  price: 80000,
  duration: '4 hours',
  description:
    'Unlimited prints, attendant, custom print design, setup and teardown.',
});
assert.equal(r.status, 200, JSON.stringify(r));
const p = r.data.packages[0];
r = await call({
  action: 'save_package',
  name: 'Wedding DJ',
  service: 'DJs',
  price: 120000,
  duration: '5 hours',
  description: 'Sound system, emcee, and personalized music planning.',
});
assert.equal(r.status, 200);
const dj = r.data.packages[0];
const event = {
  action: 'save_event',
  title: 'Morgan and Alex — sample wedding ' + Date.now(),
  client: 'Morgan Reed (Sample)',
  email: 'morgan@example.com',
  phone: '',
  date: '2026-12-12',
  time: '17:00',
  venue: 'Sample Garden Venue',
  source: 'Referral',
  notes: 'PRIVATE TEST NOTE',
  follow_up: '2026-09-08',
  deposit: 25000,
  packageIds: [p.id, dj.id],
};
r = await call(event);
assert.equal(r.status, 200, JSON.stringify(r));
const e = r.data.events.find((x) => x.title === event.title);
assert.equal(e.total, 200000);
assert.equal((await call({ ...event, deposit: 200001 })).status, 400);
assert.equal((await call({ ...event, date: '2026-02-30' })).status, 400);
assert.equal(
  (await call({ ...event, packageIds: ['unowned-package'] })).status,
  400,
);
assert.equal(
  (await call({ action: 'advance_event', id: e.id, status: 'confirmed' }))
    .status,
  400,
);
r = await call({ action: 'advance_event', id: e.id, status: 'proposal' });
assert.equal(r.status, 200);
await call({
  action: 'save_package',
  id: p.id,
  name: p.name,
  service: p.service,
  price: 90000,
  duration: p.duration,
  description: p.description,
});
r = await call({ ...event, id: e.id });
assert.equal(r.status, 200);
assert.equal(
  r.data.events.find((x) => x.id === e.id).total,
  200000,
  'Quoted prices must stay fixed',
);
r = await call({ action: 'advance_event', id: e.id, status: 'confirmed' });
assert.equal(r.status, 200);
const print = await fetch(base + '/proposal/' + e.id, {
  headers: { Cookie: cookie },
});
assert.equal(print.status, 200);
const html = await print.text();
assert.ok(html.includes(event.title));
assert.ok(
  !html.includes('PRIVATE TEST NOTE'),
  'Private notes must not appear on printable proposal',
);
const strangerUpdate = await call({
  action: 'save_package',
  id: 'foreign-package',
  name: 'Changed',
  service: 'DJs',
  price: 100,
  duration: '1 hour',
  description: '',
});
assert.equal(strangerUpdate.status, 404);
assert.equal(
  (
    await call({
      action: 'advance_event',
      id: 'foreign-event',
      status: 'proposal',
    })
  ).status,
  404,
);
assert.equal((await call({ ...event, id: 'foreign-event' })).status, 404);
const origin = await fetch(base + '/api/crm', {
  method: 'POST',
  headers: {
    Cookie: cookie,
    Origin: 'https://untrusted.example',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(event),
});
assert.equal(origin.status, 403);
const forged = await fetch(base + '/api/crm', {
  headers: {
    'oai-authenticated-user-id': 'someone-else',
    'oai-authenticated-user-email': 'other@example.com',
  },
});
assert.equal(forged.status, 401);
console.log(
  'PASS: authentication, onboarding, packages, multi-service totals, validation, fixed quoted prices, lead → proposal → booking, printable proposal privacy, record ownership, origin checks.',
);
