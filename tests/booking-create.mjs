import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const sql = new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');
for (const f of readdirSync('drizzle')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  sql.exec(readFileSync('drizzle/' + f, 'utf8'));
const db = {
  prepare(query) {
    const stmt = sql.prepare(query);
    let values = [];
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
        return { meta: { changes: stmt.run(...values).changes } };
      },
    };
  },
  async batch(items) {
    if (this.beforeBatch) {
      const hook = this.beforeBatch;
      delete this.beforeBatch;
      hook();
    }
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const item of items) results.push(await item.run());
      sql.exec('COMMIT');
      return results;
    } catch (error) {
      sql.exec('ROLLBACK');
      throw error;
    }
  },
};
let auth = { userId: 'owner-a' },
  config,
  checklistCalls = 0,
  designCalls = 0;
const operations = async (id, bid) =>
  JSON.parse(
    sql
      .prepare(
        'SELECT data FROM event_operations WHERE event_id=? AND business_id=?',
      )
      .get(id, bid)?.data || '{}',
  );
const store = {
  businessFor: async (owner) =>
    sql.prepare('SELECT * FROM businesses WHERE owner_id=?').get(owner),
  configuration: async (bid) => ({
    ...config,
    resources: sql
      .prepare('SELECT * FROM resources WHERE business_id=?')
      .all(bid)
      .map((r) => ({ ...r, data: JSON.parse(r.data) })),
  }),
  operations,
  snapshot: async (owner) => {
    const b = await store.businessFor(owner);
    return {
      events: sql.prepare('SELECT * FROM events WHERE business_id=?').all(b.id),
    };
  },
};
const native = createRequire(import.meta.url),
  cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const require = (p) => {
    if (p.endsWith('.css')) return {};
    if (p === 'next/image')
      return ({ unoptimized, ...props }) => createElement('img', props);
    const path = p.startsWith('@/')
      ? resolve(p.slice(2))
      : resolve(dirname(file), p);
    if (path === resolve('db/raw')) return { rawDb: () => db };
    if (path === resolve('app/chatgpt-auth'))
      return { getChatGPTUser: async () => auth };
    if (path === resolve('db/store')) return store;
    if (path === resolve('db/checklists'))
      return {
        addBookingChecklists: async () => {
          checklistCalls++;
        },
      };
    if (path === resolve('db/design-collections'))
      return {
        addBookingDesigns: async () => {
          designCalls++;
        },
      };
    if (path === resolve('app/event-tools')) return { EventExtras: () => null };
    if (path === resolve('app/venue-autocomplete'))
      return { VenueAutocomplete: () => null };
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
config = {
  settings: {
    ...load('lib/settings.ts').defaultSettings,
    timezone: 'America/Los_Angeles',
    noticeDays: 0,
    blackoutDates: '',
    dailyLimit: 0,
    multiplePackages: true,
  },
};
const { packageSettings } = load('lib/package-config.ts');
for (const [id, owner] of [
  ['a', 'owner-a'],
  ['b', 'owner-b'],
])
  sql
    .prepare(
      'INSERT INTO businesses(id,owner_id,name,email,services,created_at) VALUES(?,?,?,?,?,?)',
    )
    .run(
      id,
      owner,
      'Test Studio',
      'studio@example.test',
      '["Photobooths"]',
      '2026-01-01',
    );
const setPackage = (settings = {}) =>
  sql
    .prepare('UPDATE packages SET settings=? WHERE id=?')
    .run(JSON.stringify(packageSettings(settings, '4 hours')), 'booth');
sql
  .prepare(
    'INSERT INTO packages(id,business_id,name,service,price,duration,created_at) VALUES(?,?,?,?,?,?,?)',
  )
  .run('booth', 'a', 'Booth', 'Photobooths', 50000, '4 hours', '2026-01-01');
setPackage();
const resource = (id, kind, data = {}, bid = 'a') =>
  sql
    .prepare(
      'INSERT OR REPLACE INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    )
    .run(id, bid, kind, id, JSON.stringify(data), '2026-01-01', '2026-01-01');
resource('staff-a', 'staff');
resource('staff-b', 'staff', {}, 'b');
const api = load('app/api/crm/route.ts');
const base = {
  action: 'save_event',
  title: 'Test booking',
  client: 'Test client',
  email: 'client@example.test',
  date: '2090-01-20',
  time: '17:00',
  packageIds: ['booth'],
  initialStatus: 'confirmed',
  staffIds: ['staff-a'],
};
async function act(body = {}, headers = {}) {
  const r = await api.POST(
    new Request('https://eventdesk.test/api/crm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://eventdesk.test',
        ...headers,
      },
      body: JSON.stringify({ ...base, ...body }),
    }),
  );
  return { status: r.status, data: await r.json() };
}
const count = () => sql.prepare('SELECT COUNT(*) n FROM events').get().n;
const latest = () =>
  sql.prepare('SELECT * FROM events ORDER BY rowid DESC LIMIT 1').get();
async function rejected(body, pattern) {
  const before = count(),
    ops = sql.prepare('SELECT COUNT(*) n FROM event_operations').get().n;
  const r = await act(body);
  assert.equal(r.status, 400, JSON.stringify(r));
  if (pattern) assert.match(r.data.error, pattern);
  assert.equal(count(), before, 'Rejected booking creates no lead or booking');
  assert.equal(
    sql.prepare('SELECT COUNT(*) n FROM event_operations').get().n,
    ops,
    'No orphan operations',
  );
}

let r = await act();
assert.equal(r.status, 200, JSON.stringify(r));
let event = latest();
assert.equal(event.status, 'confirmed');
assert.equal(event.lifecycle, 'Active');
assert.equal(event.total, 50000);
let ops = await operations(event.id, 'a');
assert.ok(ops.sales.confirmedAt);
assert.deepEqual(ops.staffIds, ['staff-a']);
assert.equal(checklistCalls, 1);
assert.equal(designCalls, 1);
await rejected({}, /unavailable/);
await rejected({ packageIds: [] }, /Select a package/);
await rejected({ staffIds: ['staff-b'] }, /Staff unavailable/);
await rejected({ staffIds: [''] }, /Staff ID/);
await rejected({ staffIds: 'staff-a' }, /30 staff/);
await rejected({ bookingPreview: true }, /reviewed/);
await rejected({ packageIds: ['foreign'] }, /unavailable/);
await rejected({ initialStatus: 'invalid' }, /valid event status/);
assert.equal((await act({}, { Origin: 'https://other.test' })).status, 403);
auth = null;
assert.equal((await act()).status, 401);
auth = { userId: 'owner-a' };
setPackage({ requiredStaff: 2 });
await rejected(
  { date: '2090-01-21', staffIds: ['staff-a', 'staff-a'] },
  /at least 2/,
);
setPackage();
config.settings.blackoutDates = '2090-01-21';
await rejected({ date: '2090-01-21', staffIds: [] }, /unavailable/);
config.settings.blackoutDates = '';
await rejected({ date: '2000-01-01', staffIds: [] }, /notice|past|lead time/i);
config.settings.dailyLimit = 1;
await rejected({ time: '08:00', staffIds: [] }, /capacity/);
config.settings.dailyLimit = 0;
resource('shared', 'inventory_rules', { capacity: 1 });
await rejected({ staffIds: [] }, /capacity/);
sql.prepare('DELETE FROM resources WHERE id=?').run('shared');
// Simulate another request taking the date after validation, before the transaction.
config.settings.dailyLimit = 1;
db.beforeBatch = () =>
  sql
    .prepare('UPDATE events SET date=? WHERE id=?')
    .run('2090-01-22', event.id);
await rejected({ date: '2090-01-22', staffIds: [] }, /capacity/);
config.settings.dailyLimit = 0;
// Ordinary leads/proposals keep their status, even when the date is fully occupied.
for (const status of ['lead', 'proposal']) {
  r = await act({ initialStatus: status });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(latest().status, status);
}
assert.equal(checklistCalls, 1);
assert.equal(designCalls, 1);
const proposal = latest();
r = await act({
  action: 'advance_event',
  id: proposal.id,
  status: 'confirmed',
});
assert.equal(r.status, 200, JSON.stringify(r));
assert.equal(latest().status, 'confirmed');
assert.equal(checklistCalls, 2);
assert.ok((await operations(proposal.id, 'a')).sales.confirmedAt);
r = await act({
  id: proposal.id,
  initialStatus: 'lead',
  title: 'Edited booking',
});
assert.equal(r.status, 200, JSON.stringify(r));
assert.equal(latest().status, 'confirmed');
r = await act({ initialStatus: 'lead', bookingPreview: true, staffIds: [] });
assert.equal(r.status, 200, JSON.stringify(r));
assert.equal(latest().status, 'lead');
const EventForm = load('app/forms.tsx').EventForm;
const form = (status, props = {}) =>
  renderToStaticMarkup(
    createElement(EventForm, {
      data: {
        resources: [],
        settings: config.settings,
        events: [],
        packages: [],
      },
      packages: [],
      defaults: { status },
      onSave: () => {},
      busy: false,
      ...props,
    }),
  );
assert.match(form('confirmed'), /Create booking/);
assert.match(form('confirmed'), /confirmed booking and reserves/);
assert.doesNotMatch(form('confirmed'), /Create lead/);
assert.match(form('proposal'), /Create proposal/);
assert.match(form('lead'), /Create lead/);
const durationPackage = (settings) => ({
  id: 'duration-fixture', name: 'Duration fixture', service: 'Photobooths',
  price: 50000, duration: '24 hr', settings: packageSettings(settings),
});
const selectedForm = (p, props = {}) => form('confirmed', {
  packages: [p], packageLinkId: p.id, ...props,
});
const fullDay = durationPackage({ includedMinutes: 1440, minMinutes: 1440, maxMinutes: 1440 });
let durationHtml = selectedForm(fullDay);
assert.match(durationHtml, /Duration \(24 hr\)/);
assert.match(durationHtml, /<input[^>]*aria-label="Duration fixture duration hours"[^>]*value="24"/);
assert.match(durationHtml, /<input[^>]*aria-label="Duration fixture duration minutes"[^>]*value="0"/);
assert.doesNotMatch(durationHtml, /Duration in minutes/);
const halfHour = durationPackage({ includedMinutes: 270, minMinutes: 240, maxMinutes: 360, extraHours: true, extraRate: 100, increment: 30 });
durationHtml = selectedForm(halfHour);
assert.match(durationHtml, /<input[^>]*aria-label="Duration fixture duration hours"[^>]*value="4"/);
assert.match(durationHtml, /<input[^>]*aria-label="Duration fixture duration minutes"[^>]*value="30"/);
const { pricePackage } = load('lib/package-config.ts');
const priced = pricePackage(halfHour, { minutes: 330 });
assert.equal(priced.minutes, 330);
assert.equal(priced.price, 60000);
assert.throws(() => pricePackage(halfHour, { minutes: 271 }), /choose a duration/);
assert.throws(() => pricePackage(halfHour, { minutes: 390 }), /choose a duration/);
durationHtml = selectedForm(halfHour, { item: { status: 'confirmed', items: [priced] } });
assert.match(durationHtml, /<input[^>]*aria-label="Duration fixture duration hours"[^>]*disabled=""[^>]*value="5"/);
assert.match(durationHtml, /<input[^>]*aria-label="Duration fixture duration minutes"[^>]*disabled=""[^>]*value="30"/);
durationHtml = selectedForm(durationPackage({ dateMode: 'Date Only', durationUnit: 'Days', includedDays: 2 }));
assert.match(durationHtml, /<input[^>]*aria-label="Duration fixture duration in days"[^>]*value="2"/);
assert.doesNotMatch(durationHtml, /duration hours/);
sql.close();
console.log(
  'PASS: direct booking creation, status/metadata, staff selection, tenant/auth checks, package/notice/blackout/capacity/inventory validation, concurrent capacity, no orphan records, existing proposal confirmation and editing, online requests, and form labels.',
);
