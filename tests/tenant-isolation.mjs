import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
async function call(body) {
  const r = await fetch(base + '/api/crm', {
    method: body ? 'POST' : 'GET',
    headers: {
      Cookie: '__sites_local_auth=1',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const own = await call();
assert.equal(own.status, 200);
assert.ok(!own.data.events.some((e) => e.id === 'foreign-event'));
assert.ok(!own.data.packages.some((p) => p.id === 'foreign-package'));
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
assert.equal(
  (
    await call({
      action: 'save_package',
      id: 'foreign-package',
      name: 'Changed',
      service: 'DJs',
      price: 100,
      duration: '1 hour',
      description: '',
    })
  ).status,
  404,
);
assert.equal(
  (
    await call({
      action: 'save_event',
      title: 'Wrong tenant',
      client: 'Test',
      email: 'test@example.com',
      date: '2026-12-12',
      packageIds: ['foreign-package'],
    })
  ).status,
  400,
);
const p = await fetch(base + '/proposal/foreign-event', {
  headers: { Cookie: '__sites_local_auth=1' },
});
const content = await p.text();
assert.ok(!content.includes('Other Client'));
assert.ok(!content.includes('Foreign Event'));
console.log(
  'PASS: real second-business records excluded from reads, writes, package selection and proposal pages.',
);
