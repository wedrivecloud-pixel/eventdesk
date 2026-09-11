import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Exercise the actual prepared SQL against an in-memory SQLite database.
// No records are written to the user's local or hosted business.
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(
  'CREATE TABLE resources(id TEXT PRIMARY KEY,business_id TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)',
);
const d1 = {
  prepare(sql) {
    let values = [];
    const prepared = sqlite.prepare(sql);
    return {
      bind(...v) {
        values = v;
        return this;
      },
      async first() {
        return prepared.get(...values) || null;
      },
      async all() {
        return { results: prepared.all(...values) };
      },
      async run() {
        return { meta: { changes: prepared.run(...values).changes } };
      },
    };
  },
};
const users = {
  a: {
    userId: 'a',
    displayName: 'Alex Owner',
    fullName: 'Alex Owner',
    email: 'alex@example.test',
  },
  b: {
    userId: 'b',
    displayName: 'Blair Owner',
    fullName: 'Blair Owner',
    email: 'blair@example.test',
  },
};
let authenticated = users.a;
const nodeRequire = createRequire(import.meta.url),
  cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const require = (p) => {
    if (p.endsWith('.css')) return {};
    const path = p.startsWith('@/')
      ? resolve(p.slice(2))
      : resolve(dirname(file), p);
    if (path === resolve('db/raw')) return { rawDb: () => d1 };
    if (path === resolve('db/store'))
      return {
        businessFor: async (uid) =>
          users[uid] ? { id: uid, owner_id: uid } : null,
      };
    if (path === resolve('app/chatgpt-auth'))
      return { getChatGPTUser: async () => authenticated };
    if (!p.startsWith('.') && !p.startsWith('@/')) return nodeRequire(p);
    return load(path + (existsSync(path + '.ts') ? '.ts' : '.tsx'));
  };
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    require,
    module,
    module.exports,
  );
  cache.set(file, module.exports);
  return module.exports;
}
const {
  defaultProfile,
  checkedProfile,
  personalData,
  userMenuGroups,
  myAppointment,
} = load('lib/user-account.ts');
const { accountState } = load('db/user-account.ts');
const api = load('app/api/account/route.ts');
function seed(id, bid, kind, data) {
  sqlite
    .prepare('INSERT INTO resources VALUES(?,?,?,?,?,0,?,?)')
    .run(id, bid, kind, id, JSON.stringify(data), '2026-01-01', '2026-01-01');
}
seed('staff-a', 'a', 'staff', {});
seed('staff-b', 'b', 'staff', {});
seed('image-a', 'a', 'media', { mime: 'image/png' });
seed('pdf-a', 'a', 'media', { mime: 'application/pdf' });
seed('image-b', 'b', 'media', { mime: 'image/png' });
seed('doc-b', 'b', 'client_documents', {
  mediaId: 'image-b',
  staffView: true,
  customerView: true,
});
async function post(body, origin = 'https://eventdesk.test') {
  const r = await api.POST(
    new Request('https://eventdesk.test/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    }),
  );
  return { status: r.status, data: await r.json() };
}
assert.equal(userMenuGroups.flat().length, 11);
assert.equal((await post(null)).status, 400);
assert.equal((await post([])).status, 400);
assert.throws(() =>
  checkedProfile({
    ...defaultProfile(),
    firstName: 'Alex',
    contactEmail: 'invalid',
  }),
);
const profile = {
  ...defaultProfile(),
  firstName: 'Alex',
  lastName: 'Owner',
  staffId: 'staff-a',
  photoId: 'image-a',
  dailyDigest: true,
  contactEmail: 'contact@example.test',
};
let initial = await accountState('a', users.a);
assert.equal(initial.documents.length, 0);
assert.equal(
  (
    await post(
      { action: 'save_profile', profile, updatedAt: '' },
      'https://other.test',
    )
  ).status,
  403,
);
authenticated = null;
assert.equal((await api.GET()).status, 401);
assert.equal(
  (await post({ action: 'save_profile', profile, updatedAt: '' })).status,
  401,
);
authenticated = users.a;
assert.equal(
  (
    await post({
      action: 'save_profile',
      profile: { ...profile, staffId: 'staff-b' },
      updatedAt: '',
    })
  ).status,
  400,
);
assert.equal(
  (
    await post({
      action: 'save_profile',
      profile: { ...profile, photoId: 'image-b' },
      updatedAt: '',
    })
  ).status,
  400,
);
assert.equal(
  (
    await post({
      action: 'save_profile',
      profile: { ...profile, photoId: 'pdf-a' },
      updatedAt: '',
    })
  ).status,
  400,
);
let saved = await post({
  action: 'save_profile',
  profile: { ...profile, userId: 'b', adminRole: true },
  businessId: 'b',
  updatedAt: '',
});
assert.equal(saved.status, 200, JSON.stringify(saved));
assert.equal(saved.data.profile.contactEmail, 'contact@example.test');
assert.equal(saved.data.identity.email, 'alex@example.test');
assert(!('adminRole' in saved.data.profile));
assert.equal((await accountState('b', users.b)).profile.firstName, '');
assert.equal((await accountState('a', users.a)).profile.staffId, 'staff-a');
assert.equal(
  (
    await post({
      action: 'save_profile',
      profile: { ...profile, firstName: 'Stale' },
      updatedAt: '',
    })
  ).status,
  409,
);
saved = await post({
  action: 'save_support_draft',
  subject: 'Help with calendar',
  body: 'Describe the issue',
  updatedAt: saved.data.updatedAt,
});
assert.equal(saved.status, 200);
assert.equal(saved.data.profile.firstName, 'Alex');
assert.equal(
  (await accountState('a', users.a)).supportDraft.subject,
  'Help with calendar',
);
assert.equal(
  (await post({ action: 'send_support', subject: 'Do not send' })).status,
  400,
);
assert.equal(
  (
    await post({
      action: 'save_document',
      name: 'Foreign',
      mediaId: 'image-b',
      staffView: true,
      customerView: true,
    })
  ).status,
  400,
);
const doc = await post({
  action: 'save_document',
  name: 'Insurance certificate',
  mediaId: 'pdf-a',
  staffView: true,
  customerView: false,
});
assert.equal(doc.status, 200, JSON.stringify(doc));
const id = doc.data.documents[0].id;
assert.equal(doc.data.documents[0].data.customerView, false);
assert.equal(
  (
    await post({
      action: 'save_document',
      id: 'doc-b',
      name: 'Overwrite',
      mediaId: 'pdf-a',
      staffView: true,
      customerView: true,
    })
  ).status,
  400,
);
assert.equal(
  (await post({ action: 'archive_document', id: 'doc-b' })).status,
  400,
);
assert.equal(
  (
    await post({
      action: 'save_document',
      id,
      name: 'Updated certificate',
      mediaId: 'pdf-a',
      staffView: false,
      customerView: true,
    })
  ).status,
  200,
);
assert.equal(
  (await accountState('a', users.a)).documents[0].name,
  'Updated certificate',
);
assert.equal((await post({ action: 'archive_document', id })).status, 200);
assert.equal((await accountState('a', users.a)).documents.length, 0);
assert.equal((await accountState('b', users.b)).documents[0].id, 'doc-b');
assert.equal(
  sqlite
    .prepare(
      "SELECT COUNT(*) AS count FROM resources WHERE id='pdf-a' AND archived=0",
    )
    .get().count,
  1,
);

const event = (id, staffIds, tasks = []) => ({
  id,
  title: id,
  status: 'confirmed',
  date: '2026-11-01',
  time: '12:00',
  items: [],
  operations: { staffIds, tasks },
});
const record = (id, kind, data) => ({
  id,
  kind,
  data,
  archived: 0,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
});
const data = {
  business: { id: 'a', name: 'Example', services: [] },
  packages: [],
  events: [
    event(
      'my-event',
      ['staff-a'],
      [
        { id: 'mine', assignee: 'owner', label: 'Owner task', done: false },
        {
          id: 'other',
          assignee: 'staff-other',
          label: 'Other task',
          done: false,
        },
      ],
    ),
    event(
      'other-event',
      ['staff-other'],
      [
        {
          id: 'assigned',
          assignee: 'staff-a',
          label: 'Assigned task',
          done: false,
        },
      ],
    ),
  ],
  resources: [],
  sales: [
    record('owner-appt', 'appointment', { organizer: 'owner' }),
    record('staff-appt', 'appointment', { organizer: 'staff-a' }),
    record('attendee-appt', 'appointment', {
      organizer: 'staff-other',
      staffIds: ['staff-a'],
    }),
    record('other-appt', 'appointment', { organizer: 'staff-other' }),
    record('owner-task', 'task', { assignee: 'owner' }),
    record('staff-task', 'task', { assignee: 'staff-a' }),
    record('other-task', 'task', { assignee: 'staff-other' }),
    record('my-off', 'time_off', { staffId: 'staff-a' }),
    record('other-off', 'time_off', { staffId: 'staff-other' }),
  ],
};
assert.deepEqual(
  personalData(data, 'staff-a', 'My Bookings').events.map((e) => e.id),
  ['my-event'],
);
assert.equal(personalData(data, '', 'My Bookings').events.length, 0);
assert.equal(personalData(data, 'staff-a', 'My Appointments').events.length, 2);
assert.deepEqual(
  personalData(data, 'staff-a', 'My Calendar')
    .sales.filter((r) => r.kind === 'appointment')
    .map((r) => r.id),
  ['owner-appt', 'staff-appt', 'attendee-appt'],
);
assert(myAppointment(data.sales[2], 'staff-a'));
const tasks = personalData(data, 'staff-a', 'My Checklist');
assert.deepEqual(
  tasks.events.flatMap((e) => e.operations.tasks).map((t) => t.id),
  ['mine', 'assigned'],
);
assert.equal(
  data.events[0].operations.tasks.length,
  2,
  'Source snapshot must not be mutated',
);
assert.equal(
  personalData(data, '', 'My Calendar').sales.filter(
    (r) => r.kind === 'time_off',
  ).length,
  0,
);

// Render the real user pages with an in-memory controller, without persisting browser fixtures.
const { UserWorkspace } = load('app/user-options.tsx');
const { defaultDashboard } = load('lib/overview.ts');
const beforeDashboard = await accountState('a', users.a);
const dashboard = defaultDashboard();
dashboard.widgets[0].enabled = false;
dashboard.widgets[1].limit = 7;
dashboard.widgets.reverse();
const dashboardSaved = await post({
  action: 'save_dashboard',
  dashboard,
  updatedAt: beforeDashboard.updatedAt,
  businessId: 'b',
});
assert.equal(dashboardSaved.status, 200);
assert.deepEqual((await accountState('a', users.a)).dashboard, dashboard);
assert.deepEqual(
  (await accountState('b', users.b)).dashboard,
  defaultDashboard(),
);
assert.equal(dashboardSaved.data.profile.firstName, 'Alex');
assert.equal(dashboardSaved.data.supportDraft.subject, 'Help with calendar');
assert.equal(
  (
    await post({
      action: 'save_dashboard',
      dashboard,
      updatedAt: beforeDashboard.updatedAt,
    })
  ).status,
  409,
);
assert.equal(
  (
    await post({
      action: 'save_dashboard',
      dashboard: { widgets: [] },
      updatedAt: dashboardSaved.data.updatedAt,
    })
  ).status,
  400,
);
const profileAfterDashboard = await post({
  action: 'save_profile',
  profile,
  updatedAt: dashboardSaved.data.updatedAt,
});
assert.equal(profileAfterDashboard.status, 200);
assert.deepEqual(
  profileAfterDashboard.data.dashboard,
  dashboard,
  'Profile saves must retain dashboard settings',
);
const draftAfterDashboard = await post({
  action: 'save_support_draft',
  subject: 'Help with calendar',
  body: 'Retain layout',
  updatedAt: profileAfterDashboard.data.updatedAt,
});
assert.deepEqual(
  draftAfterDashboard.data.dashboard,
  dashboard,
  'Support draft saves must retain dashboard settings',
);
const { defaultOverview, defaultRevenue } = load('lib/overview-preferences.ts');
const oldLayout = (await accountState('a', users.a)).dashboard;
const newLayout = defaultOverview();
newLayout.widgets.find((w) => w.id === 'attention').limit = 4;
let newSaved = await post({
  action: 'save_overview',
  overview: newLayout,
  businessId: 'b',
  updatedAt: draftAfterDashboard.data.updatedAt,
});
assert.equal(newSaved.status, 200, JSON.stringify(newSaved));
assert.deepEqual(newSaved.data.overview, newLayout);
assert.deepEqual(
  newSaved.data.dashboard,
  oldLayout,
  'Restore point layout must stay unchanged',
);
assert.notDeepEqual((await accountState('b', users.b)).overview, newLayout);
const revenuePrefs = {
  ...defaultRevenue('2026-09-06'),
  basis: 'Booked',
  group: 'Month',
  compare: false,
};
let revenueSaved = await post({
  action: 'save_overview_revenue',
  preferences: revenuePrefs,
  updatedAt: newSaved.data.updatedAt,
});
assert.equal(revenueSaved.status, 200, JSON.stringify(revenueSaved));
assert.deepEqual(revenueSaved.data.overviewRevenue, revenuePrefs);
assert.deepEqual(revenueSaved.data.overview, newLayout);
assert.deepEqual(revenueSaved.data.dashboard, oldLayout);
assert.equal((await accountState('b', users.b)).overviewRevenue, undefined);
assert.equal(
  (
    await post({
      action: 'save_overview',
      overview: newLayout,
      updatedAt: newSaved.data.updatedAt,
    })
  ).status,
  409,
);
assert.equal(
  (
    await post({
      action: 'save_overview_revenue',
      preferences: { ...revenuePrefs, from: 'invalid' },
      updatedAt: revenueSaved.data.updatedAt,
    })
  ).status,
  400,
);
const retained = await post({
  action: 'save_profile',
  profile,
  updatedAt: revenueSaved.data.updatedAt,
});
assert.equal(retained.status, 200);
assert.deepEqual(retained.data.overview, newLayout);
assert.deepEqual(retained.data.overviewRevenue, revenuePrefs);
assert.deepEqual(retained.data.dashboard, oldLayout);
console.log(
  'PASS: redesigned layout and revenue preference persistence, tenant isolation, stale-write rejection, validation, and legacy restore-point preservation.',
);
const current = await accountState('a', users.a);
const controller = {
  account: current,
  error: '',
  notice: '',
  busy: false,
  reload: async () => {},
  run: async () => true,
};
const props = {
  data,
  onData: () => {},
  onOpen: () => {},
  onNavigate: () => {},
  onCreateEvent: () => {},
  controller,
};
for (const [view, expected] of [
  ['My Profile', 'Contact Email'],
  ['Client Documents', 'New Document'],
  ['Billing', 'Subscription billing is not connected'],
  ['Support', 'Support request draft'],
  ['Set Booking Availability', 'Connect your staff profile'],
  ['Appointment Scheduling', 'Connect your staff profile'],
]) {
  const html = renderToStaticMarkup(
    createElement(UserWorkspace, { ...props, view }),
  );
  assert(html.includes(expected), view);
}
console.log(
  'PASS: personal assignment filters, profile and draft persistence, document CRUD, tenant/media isolation, sign-in checks, cross-origin rejection, stale-write protection, and actual account-page rendering. All database tests ran in memory.',
);
sqlite.close();

if (process.argv.includes('--local')) {
  const base = 'http://localhost:3000';
  assert.equal((await fetch(base + '/api/account')).status, 401);
  const r = await fetch(base + '/api/account', {
    headers: { Cookie: '__sites_local_auth=1' },
  });
  assert.equal(r.status, 200);
  const state = await r.json();
  assert.equal(state.identity.email, 'seedy@sites.test');
  assert(Array.isArray(state.documents));
  const html = await fetch(base + '/').then((r) => r.text());
  assert(html.includes('EventDesk'));
  console.log(
    'PASS: local account endpoint authenticated response and anonymous rejection, using read-only requests.',
  );
}
