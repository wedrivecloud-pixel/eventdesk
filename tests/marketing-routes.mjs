import assert from 'node:assert/strict';

// Read-only HTTP regression checks. Run against a locally running preview.
const origin = process.env.MARKETING_TEST_ORIGIN || 'http://localhost:3105';
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname),
  'Use a local preview',
);
for (const path of ['/', '/welcome']) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.match(html, /THE CRM FOR EVENT PROFESSIONALS/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /eventdeskly-logo\.png/);
  assert.match(html, /mode=signup/);
  assert.match(html, /id="pricing"/);
  assert.match(html, /id="demo"/);
}
const legacy = await fetch(
  origin + '/?section=business-settings&panel=tax&tag=a&tag=b',
  { redirect: 'manual' },
);
assert.equal(legacy.status, 307);
const destination = new URL(legacy.headers.get('location'), origin);
assert.equal(destination.pathname, '/app');
assert.equal(destination.searchParams.get('section'), 'business-settings');
assert.equal(destination.searchParams.get('panel'), 'tax');
assert.deepEqual(destination.searchParams.getAll('tag'), ['a', 'b']);
const app = await fetch(origin + '/app');
assert.equal(app.status, 200, 'Existing CRM route renders');
assert.doesNotMatch(await app.text(), /THE CRM FOR EVENT PROFESSIONALS/);
console.log(
  'PASS: public homepage, preview alias, metadata, registration link, legacy query preservation and separate CRM route.',
);
