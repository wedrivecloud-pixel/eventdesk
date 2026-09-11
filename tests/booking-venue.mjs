import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE booking_rate_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE events(id TEXT PRIMARY KEY,business_id TEXT,title TEXT,client TEXT,email TEXT,phone TEXT,date TEXT,time TEXT,venue TEXT,source TEXT,status TEXT,items TEXT,total INTEGER,deposit INTEGER,notes TEXT,follow_up TEXT,created_at TEXT,updated_at TEXT);
CREATE TABLE event_operations(event_id TEXT PRIMARY KEY,business_id TEXT,data TEXT);`);
const db = {
  prepare(query) {
    let values = [];
    const stmt = sql.prepare(query);
    return {
      bind(...v) {
        values = v;
        return this;
      },
      async first() {
        return stmt.get(...values) || null;
      },
      async all() {
        return { results: stmt.all(...values) };
      },
      async run() {
        return stmt.run(...values);
      },
    };
  },
  async batch(statements) {
    sql.exec('BEGIN');
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      sql.exec('COMMIT');
      return out;
    } catch (e) {
      sql.exec('ROLLBACK');
      throw e;
    }
  },
};
let authenticated = null;
const env = {},
  native = createRequire(import.meta.url),
  cache = new Map(),
  contexts = {
    active: {
      bid: 'business-a',
      p: { id: 'active', settings: { bookingMode: 'Request a quote' } },
      settings: { requireConsent: false },
      resources: [],
    },
    second: {
      bid: 'business-b',
      p: { id: 'second', settings: { bookingMode: 'Request a quote' } },
      settings: { requireConsent: false },
      resources: [],
    },
  };
const digest = async (value) =>
  createHash('sha256').update(value).digest('hex');
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const require = (p) => {
    if (p.endsWith('.css')) return {};
    if (p === 'cloudflare:workers') return { env };
    const path = p.startsWith('@/')
      ? resolve(p.slice(2))
      : resolve(dirname(file), p);
    if (path === resolve('db/raw')) return { rawDb: () => db };
    if (path === resolve('app/chatgpt-auth'))
      return { getChatGPTUser: async () => authenticated };
    if (path === resolve('db/store')) return { businessFor: async () => null };
    if (path === resolve('db/manage-guards'))
      return { discountGuard: () => db.prepare('SELECT 1') };
    if (path === resolve('db/public-booking'))
      return {
        digest,
        bookingContext: async (id) => contexts[id] || null,
        bookingSelection: (body) => ({
          date: body.date,
          time: body.time,
          minutes: 240,
          units: 1,
          addonIds: [],
          backdropId: '',
          discountCode: '',
        }),
        bookingQuote: async () => ({
          view: { token: 'estimate' },
          quote: { discountId: '', total: 50000, depositDefault: 15000 },
          item: { id: 'active', name: 'Event package' },
        }),
      };
    if (!p.startsWith('.') && !p.startsWith('@/')) return native(p);
    return load(path + (existsSync(path + '.ts') ? '.ts' : '.tsx'));
  };
  new Function(
    'require',
    'module',
    'exports',
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
  )(require, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { checkedBookingVenue, bookingVenueText, venueFromSuggestion } = load(
  'lib/booking-venue.ts',
);
const { googleVenue } = load('lib/venue-autocomplete.ts');
const googlePlace = {
  id: 'place-a',
  displayName: { text: 'Garden Hall' },
  formattedAddress: '266 Race St, San Jose, CA 95126, USA',
  postalAddress: {
    addressLines: ['266 Race St'],
    locality: 'San Jose',
    administrativeArea: 'CA',
    postalCode: '95126',
    regionCode: 'US',
  },
};
const suggestion = googleVenue(googlePlace),
  location = {
    name: 'Garden Hall',
    address: '266 Race St',
    address2: 'Suite 4',
    city: 'San Jose',
    state: 'CA',
    postalCode: '95126',
    country: 'US',
  };
assert.equal(suggestion.streetAddress, '266 Race St');
assert.equal(suggestion.city, 'San Jose');
assert.equal(suggestion.country, 'US');
assert.equal(
  venueFromSuggestion(suggestion, location).address2,
  '',
  'Changing venues clears stale unit information',
);
assert.equal(
  venueFromSuggestion(
    suggestion,
    { ...location, name: 'Private residence' },
    true,
  ).name,
  'Private residence',
);
assert.equal(
  bookingVenueText(location),
  'Garden Hall, 266 Race St, Suite 4, San Jose, CA 95126, US',
);
assert.throws(() => checkedBookingVenue({ ...location, address: '' }));
assert.throws(() =>
  checkedBookingVenue({ ...location, postalCode: 'x'.repeat(31) }),
);
assert.throws(() => checkedBookingVenue([]));
assert.equal(checkedBookingVenue(null), undefined);
const { BookingVenueSummary } = load('app/booking-venue.tsx');
let html = renderToStaticMarkup(
  createElement(BookingVenueSummary, { venue: location }),
);
for (const line of [
  'Venue address',
  '266 Race St',
  'Suite 4',
  'San Jose, CA 95126',
])
  assert(html.includes(line));
html = renderToStaticMarkup(
  createElement(BookingVenueSummary, { venue: null }),
);
assert(html.includes('Venue to be confirmed'));
const booking = load('app/api/booking/route.ts');
const submit = (body) =>
  booking.POST(
    new Request('https://eventdesk.example/api/booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://eventdesk.example',
        'cf-connecting-ip': '192.0.2.10',
      },
      body: JSON.stringify(body),
    }),
  );
const body = {
  action: 'submit',
  packageId: 'active',
  date: '2027-02-20',
  time: '17:00',
  firstName: 'Test',
  lastName: 'Client',
  email: 'client@example.test',
  phone: '555-0100',
  title: 'Venue test',
  venue: 'Old venue field ignored',
  venueDetails: location,
  acknowledged: true,
  requestId: randomUUID(),
  quoteToken: 'estimate',
};
let result = await submit(body);
assert.equal(result.status, 200, await result.clone().text());
const saved = sql
    .prepare('SELECT * FROM events WHERE id=?')
    .get(body.requestId),
  ops = JSON.parse(
    sql
      .prepare('SELECT data FROM event_operations WHERE event_id=?')
      .get(body.requestId).data,
  );
assert.equal(saved.venue, bookingVenueText(location));
assert.equal(saved.status, 'lead');
assert.equal(ops.sales.review, true);
assert.equal(ops.customerRequest.approvalRequired, true);
assert.deepEqual(ops.customerRequest.venueDetails, location);
assert.equal((await submit(body)).status, 200);
assert.equal(sql.prepare('SELECT count(*) AS n FROM events').get().n, 1);
assert.equal(
  (
    await submit({
      ...body,
      venueDetails: { ...location, address2: 'Suite 5' },
    })
  ).status,
  409,
);
assert.equal(
  (
    await submit({
      ...body,
      requestId: randomUUID(),
      venueDetails: { ...location, address: '' },
    })
  ).status,
  400,
);
const legacy = {
  ...body,
  requestId: randomUUID(),
  venueDetails: undefined,
  venue: 'Legacy venue',
};
assert.equal((await submit(legacy)).status, 200);
assert.equal(
  sql.prepare('SELECT venue FROM events WHERE id=?').get(legacy.requestId)
    .venue,
  'Legacy venue',
);
const unknown = {
  ...body,
  requestId: randomUUID(),
  venueDetails: null,
  venue: '',
};
assert.equal((await submit(unknown)).status, 200);
assert.equal(
  sql.prepare('SELECT venue FROM events WHERE id=?').get(unknown.requestId)
    .venue,
  '',
);
const places = load('app/api/places/route.ts');
assert.equal((await places.GET()).status, 401);
const get = (id) =>
  places.GET(new Request('https://eventdesk.example/api/places?package=' + id));
assert.equal((await get('missing')).status, 404);
assert.deepEqual(await (await get('active')).json(), { connected: false });
const sessionToken = randomUUID();
const search = (patch = {}, ip = '192.0.2.30') =>
  places.POST(
    new Request('https://eventdesk.example/api/places', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://eventdesk.example',
        'cf-connecting-ip': ip,
      },
      body: JSON.stringify({
        packageId: 'active',
        action: 'suggest',
        query: 'Garden',
        sessionToken,
        ...patch,
      }),
    }),
  );
assert.equal((await search()).status, 503);
let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  calls++;
  return Response.json(
    url.includes('autocomplete')
      ? {
          suggestions: [
            {
              placePrediction: {
                placeId: 'place-a',
                structuredFormat: {
                  mainText: { text: 'Garden Hall' },
                  secondaryText: { text: googlePlace.formattedAddress },
                },
              },
            },
          ],
        }
      : googlePlace,
  );
};
env.GOOGLE_PLACES_API_KEY = 'test-only-placeholder';
try {
  assert.equal((await search({ packageId: 'disabled' })).status, 404);
  assert.equal(calls, 0);
  result = await search();
  assert.equal(result.status, 200);
  const suggestions = await result.json();
  assert.equal(suggestions.suggestions.length, 1);
  assert(!JSON.stringify(suggestions).includes('resources'));
  assert(!JSON.stringify(suggestions).includes('business-a'));
  result = await search({ action: 'details', placeId: 'place-a' });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).venue.streetAddress, '266 Race St');
  for (let i = 0; i < 58; i++) assert.equal((await search()).status, 200);
  assert.equal((await search()).status, 429);
  assert.equal(
    (await search({ packageId: 'second' })).status,
    200,
    'Business quotas are isolated',
  );
  assert.equal(
    (await search({}, '192.0.2.31')).status,
    200,
    'Client quota is per IP',
  );
  const day = Math.floor(Date.now() / 1000 / 86400),
    key = await digest(
      JSON.stringify(['places', 'business-a', 'business', day, 86400]),
    );
  sql.prepare('UPDATE booking_rate_limits SET hits=1000 WHERE key=?').run(key);
  assert.equal(
    (await search({}, '192.0.2.32')).status,
    429,
    'Business daily limit cannot be bypassed by switching clients',
  );
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  'PASS: structured venue validation and formatting; anonymous submission/persistence; exact retry and changed-address conflict; legacy/TBC compatibility; public package-scoped lookup; durable client/business quotas; no private venue exposure. In-memory test data and mocked Google responses only.',
);
