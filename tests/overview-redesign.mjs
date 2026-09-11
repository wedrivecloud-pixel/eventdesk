import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const native = createRequire(import.meta.url),
  cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const require = (p) => {
    if (!p.startsWith('.') && !p.startsWith('@/')) return native(p);
    const path = p.startsWith('@/')
      ? resolve(p.slice(2))
      : resolve(dirname(file), p);
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
      },
    }).outputText,
  )(require, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { overviewPriorities, eventReadiness, overviewSummary, pendingRequest } =
  load('lib/overview-priorities.ts');
const {
  defaultOverview,
  checkedOverview,
  defaultRevenue,
  checkedRevenue,
  previousRevenuePeriod,
  revenueComparison,
} = load('lib/overview-preferences.ts');
const { defaultDashboard, revenueSnapshot } = load('lib/overview.ts');
const e = (id, extra = {}) => ({
  id,
  title: id,
  client: 'Client',
  email: 'client@example.test',
  phone: '',
  venue: '',
  time: '17:00',
  date: '2026-09-20',
  status: 'confirmed',
  lifecycle: 'Active',
  items: [],
  total: 10000,
  deposit: 2000,
  created_at: '2026-09-01T01:00:00Z',
  updated_at: '2026-09-01',
  follow_up: '',
  source: '',
  operations: {},
  ...extra,
});
const data = {
  business: { id: 'a', name: 'Studio', services: [] },
  settings: { timezone: 'America/Los_Angeles' },
  packages: [],
  resources: [{ id: 'staff', kind: 'staff', archived: 0 }],
  sales: [],
  payments: [],
  events: [],
};
const today = '2026-09-06';
const request = e('request', {
  status: 'lead',
  source: 'Online booking request',
  operations: { sales: { review: true, origin: 'Online booking' } },
});
const reviewed = e('reviewed', {
  ...request,
  id: 'reviewed',
  operations: { sales: { review: false, origin: 'Online booking' } },
});
const old = e('old', { date: '2026-08-20', deposit: 0 });
const prep = e('prep', {
  items: [{ id: 'p', packageSettings: { requiredStaff: 2 } }],
  operations: {
    staffIds: ['staff', 'missing'],
    questions: [
      {
        id: 'a',
        label: 'Required',
        type: 'Text Field',
        required: true,
        answer: '',
      },
      {
        id: 'b',
        label: 'Conditional',
        type: 'Text Field',
        required: true,
        conditionField: 'a',
        conditionValue: 'Yes',
        answer: '',
      },
      { id: 'c', label: 'Header', type: 'Header', required: true, answer: '' },
    ],
    tasks: [
      { id: '1', label: 'Load equipment', done: false, due: '2026-09-19' },
      { id: '2', label: 'Send gallery', done: false, due: '2026-09-25' },
    ],
  },
});
const proposal = e('proposal', {
  status: 'proposal',
  operations: { quote: { validUntil: '2026-09-10' } },
});
data.events = [
  request,
  reviewed,
  old,
  prep,
  proposal,
  e('lead', { status: 'lead' }),
  e('canceled', { lifecycle: 'Canceled' }),
  e('archived', { lifecycle: 'Archived' }),
  e('postponed', { lifecycle: 'Postponed' }),
  e('far', { date: '2027-01-01', deposit: 0 }),
];
data.payments = [
  { id: 'cash', event_id: 'prep', amount: 2000, date: today, tip: 1000 },
  { id: 'previous', event_id: 'old', amount: 1000, date: '2026-08-02' },
];
assert(pendingRequest(request));
assert(!pendingRequest(reviewed));
assert(!pendingRequest({ ...request, status: 'confirmed' }));
assert(!pendingRequest({ ...request, lifecycle: 'Canceled' }));
const before = JSON.stringify(data),
  items = overviewPriorities(data, today);
assert.equal(items[0].event.id, 'old');
assert.equal(items[0].label, 'Payment past due');
assert.equal(items.filter((i) => i.category === 'approval').length, 1);
assert.equal(items.find((i) => i.category === 'approval').due, '2026-08-31');
assert(
  !items.some((i) =>
    ['canceled', 'archived', 'postponed'].includes(i.event.id),
  ),
);
assert(
  items.some((i) => i.event.id === 'proposal' && i.category === 'proposal'),
);
assert(items.some((i) => i.event.id === 'lead' && i.category === 'followup'));
const ready = eventReadiness(prep, data, today);
assert.equal(ready.find((x) => x.key === 'payment').state, 'done');
assert.equal(ready.find((x) => x.key === 'staff').detail, '1 more needed');
assert.equal(
  ready.find((x) => x.key === 'questions').detail,
  '1 required answer missing',
);
assert.equal(
  ready.find((x) => x.key === 'checklist').detail,
  '0/1 complete',
  'Post-event tasks do not block event readiness',
);
const unset = eventReadiness(e('unset', { deposit: 0 }), data, today);
assert.equal(unset.find((x) => x.key === 'questions').state, 'unset');
assert.equal(unset.find((x) => x.key === 'checklist').state, 'unset');
const finalized = structuredClone(prep);
finalized.operations.questions[0].answer = 'No';
finalized.operations.questionsFinalized = true;
assert.equal(
  eventReadiness(finalized, data, today).find((x) => x.key === 'questions')
    .state,
  'done',
);
finalized.operations.questions[0].answer = 'Yes';
assert.equal(
  eventReadiness(finalized, data, today).find((x) => x.key === 'questions')
    .state,
  'needed',
  'Finalization cannot mask missing visible required answers',
);
const sum = overviewSummary(data, today);
assert.equal(sum.collected, 2000);
assert.equal(sum.requests, 1);
assert.equal(sum.upcoming, 1);
assert.equal(sum.outstanding, 37000);
assert.equal(JSON.stringify(data), before);
assert.equal(defaultOverview().widgets[0].id, 'summary');
assert.equal(defaultOverview().widgets[1].id, 'attention');
// Core overview cards stay visible even before the business has recorded activity.
assert.equal(
  defaultOverview().widgets.find((x) => x.id === 'revenue').hideEmpty,
  false,
);
assert.equal(
  defaultOverview().widgets.find((x) => x.id === 'attention').hideEmpty,
  false,
);
const legacy = defaultDashboard();
legacy.widgets[0].enabled = false;
legacy.widgets[1].limit = 8;
const modern = defaultOverview(legacy);
assert.equal(modern.widgets.find((x) => x.id === 'revenue').enabled, false);
assert.equal(modern.widgets.find((x) => x.id === 'upcoming').limit, 8);
assert.deepEqual(checkedOverview(modern), modern);
assert.throws(() => checkedOverview({ widgets: modern.widgets.slice(1) }));
assert.throws(() =>
  checkedOverview({ widgets: [...modern.widgets.slice(1), null] }),
);
const prefs = defaultRevenue(today);
assert.equal(prefs.range, 'This month');
assert.equal(prefs.basis, 'Payment');
assert.deepEqual(checkedRevenue(prefs), prefs);
assert.throws(() => checkedRevenue({ ...prefs, group: 'hour' }));
assert.deepEqual(previousRevenuePeriod(prefs, today), {
  from: '2026-08-01',
  to: '2026-08-31',
});
assert.deepEqual(
  previousRevenuePeriod({ ...prefs, range: 'Month to date' }, '2024-03-31'),
  { from: '2024-02-01', to: '2024-02-29' },
);
assert.deepEqual(
  previousRevenuePeriod({ ...prefs, range: 'Last 7 days' }, '2026-01-03'),
  { from: '2025-12-21', to: '2025-12-27' },
);
assert.equal(revenueComparison(data, prefs, today).total.paid, 1000);
assert.equal(revenueSnapshot(data, prefs, today).total.paid, 2000);
console.log(
  'PASS: actionable priorities, approval semantics, lifecycle exclusions, readiness with conditional questions and post-event tasks, summary totals, comparison ranges, and legacy layout compatibility. No saved records changed.',
);

assert.deepEqual(
  previousRevenuePeriod({ ...prefs, range: 'This year' }, '2024-09-06'),
  { from: '2023-01-01', to: '2023-12-31' },
);
assert.deepEqual(
  previousRevenuePeriod({ ...prefs, range: 'Year to date' }, '2024-02-29'),
  { from: '2023-01-01', to: '2023-02-28' },
);
