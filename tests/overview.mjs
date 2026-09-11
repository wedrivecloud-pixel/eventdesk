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
const {
  revenueSnapshot,
  revenuePeriod,
  businessDay,
  overdueBalance,
  recentlyBooked,
  defaultDashboard,
  checkedDashboard,
} = load('lib/overview.ts');
const event = (id, total, extra = {}) => ({
  id,
  total,
  status: 'confirmed',
  lifecycle: 'Active',
  date: '2026-09-26',
  created_at: '2026-01-01T00:00:00Z',
  operations: { sales: { confirmedAt: '2026-08-01T00:00:00Z' } },
  ...extra,
});
const data = {
  business: { id: 'a', name: 'Test' },
  packages: [],
  resources: [],
  settings: { timezone: 'America/Los_Angeles' },
  events: [
    event('active', 10000, {
      operations: {
        sales: { confirmedAt: '2026-09-01T08:00:00Z' },
        paymentPlan: {
          schedule: [
            { date: '2026-09-01', amount: 5000 },
            { date: '2026-09-25', amount: 5000 },
          ],
        },
      },
    }),
    event('postponed', 5000, { lifecycle: 'Postponed' }),
    event('canceled', 8000, { lifecycle: 'Canceled' }),
    event('proposal', 20000, { status: 'proposal' }),
    event('archived', 12000, { lifecycle: 'Archived' }),
  ],
  payments: [
    {
      id: 'p1',
      event_id: 'active',
      amount: 3000,
      tip: 1200,
      date: '2026-09-01',
    },
    { id: 'p2', event_id: 'postponed', amount: 1000, date: '2026-08-01' },
    { id: 'p3', event_id: 'canceled', amount: 1000, date: '2026-09-01' },
  ],
};
const filter = {
    basis: 'Scheduled',
    range: 'Last 12 months',
    group: 'Month',
    from: '',
    to: '',
  },
  today = '2026-09-07';
const original = JSON.stringify(data),
  r = revenueSnapshot(data, filter, today);
assert.equal(r.rows.length, 12);
assert.equal(r.rows[0].key, '2025-10-01');
assert.deepEqual(r.total, {
  paid: 4000,
  projected: 5000,
  postponed: 4000,
  pastDue: 2000,
  total: 15000,
  count: 2,
});
assert.equal(r.average, 7500);
for (const row of r.rows)
  assert.equal(
    row.paid + row.projected + row.postponed + row.pastDue,
    row.total,
  );
const payment = revenueSnapshot(
  data,
  {
    ...filter,
    basis: 'Payment',
    range: 'Custom',
    from: '2026-09-01',
    to: '2026-09-30',
  },
  today,
);
assert.equal(
  payment.total.paid,
  4000,
  'Payment dates govern collected revenue; canceled-booking receipts remain cash received; tips are excluded',
);
assert.equal(payment.total.count, 2);
assert.equal(payment.total.projected, 0);
assert.equal(
  payment.rows[0].count,
  2,
  'Payment buckets count distinct bookings',
);
const multiple = revenueSnapshot(
  {
    ...data,
    payments: [
      ...data.payments,
      { id: 'p4', event_id: 'active', amount: 2500, date: '2026-09-03' },
      { id: 'p5', event_id: 'active', amount: 600, date: '2026-10-03' },
    ],
  },
  {
    ...filter,
    basis: 'Payment',
    range: 'Custom',
    from: '2026-09-02',
    to: '2026-10-04',
  },
  today,
);
assert.equal(multiple.rows[0].count, 1);
assert.equal(multiple.rows[1].count, 1);
assert.equal(
  multiple.total.count,
  1,
  'A booking in two buckets is counted once in the overall total',
);
assert.equal(multiple.rows[0].from, '2026-09-02');
assert.equal(multiple.rows[1].to, '2026-10-04');
assert.deepEqual(
  multiple.rows[0].entries.map((e) => e.paymentId),
  ['p4'],
);
const sameBucket = revenueSnapshot(
  {
    ...data,
    payments: [
      ...data.payments,
      { id: 'repeat', event_id: 'active', amount: 2500, date: '2026-09-03' },
    ],
  },
  { ...filter, basis: 'Payment' },
  today,
).rows.at(-1);
assert.equal(sameBucket.entries.length, 3);
assert.equal(
  sameBucket.count,
  2,
  'Multiple payments must not inflate the booking count',
);
for (const basis of ['Scheduled', 'Booked', 'Payment']) {
  for (const group of ['Day', 'Week', 'Month', 'Quarter', 'Year']) {
    const snapshot = revenueSnapshot(
      data,
      {
        ...filter,
        basis,
        group,
        range: 'Custom',
        from: '2026-08-02',
        to: '2026-09-28',
      },
      today,
    );
    for (const row of snapshot.rows) {
      assert.equal(
        row.count,
        new Set(row.entries.map((entry) => entry.event.id)).size,
      );
      for (const key of ['paid', 'projected', 'postponed', 'pastDue', 'total'])
        assert.equal(
          row.entries.reduce((sum, entry) => sum + entry[key], 0),
          row[key],
          `${basis}/${group}: ${key} details must match the graph`,
        );
      assert.ok(
        row.entries.every(
          (entry) => entry.date >= row.from && entry.date <= row.to,
        ),
      );
      assert.ok(
        row.from >= snapshot.period.from && row.to <= snapshot.period.to,
        'Partial buckets respect the selected date range',
      );
    }
  }
}
assert.deepEqual(
  r.rows[0].entries,
  [],
  'Empty periods still have an inspectable zero breakdown',
);
assert.deepEqual(
  r.rows
    .at(-1)
    .entries.map((entry) => entry.event.id)
    .sort(),
  ['active', 'postponed'],
);
const booked = revenueSnapshot(
  data,
  {
    ...filter,
    basis: 'Booked',
    range: 'Custom',
    from: '2026-09-01',
    to: '2026-09-30',
  },
  today,
);
assert.equal(
  booked.total.total,
  10000,
  'Booked date is independent of scheduled date',
);
assert.equal(
  businessDay('2026-01-01T01:00:00Z', 'America/Los_Angeles'),
  '2025-12-31',
);
assert.equal(
  overdueBalance(
    event('x', 10000, { operations: { quote: { dueDate: today } } }),
    1000,
    today,
  ),
  0,
  'Due today is not past due',
);
assert.equal(
  overdueBalance(data.events[0], 6000, today),
  0,
  'Paid installment is not overdue',
);
assert.equal(
  overdueBalance(data.events[0], 15000, today),
  0,
  'Overpayment never produces a negative balance',
);
const overpaid = {
  ...data,
  events: [event('active', 10000)],
  payments: [
    {
      id: 'over',
      event_id: 'active',
      amount: 15000,
      tip: 0,
      date: '2026-09-01',
    },
  ],
};
assert.equal(revenueSnapshot(overpaid, filter, today).total.paid, 10000);
assert.equal(
  revenueSnapshot(overpaid, { ...filter, basis: 'Payment' }, today).total.paid,
  15000,
);
assert.deepEqual(revenuePeriod('Last year', today), {
  from: '2025-01-01',
  to: '2025-12-31',
});
assert.deepEqual(revenuePeriod('Quarter to date', today), {
  from: '2026-07-01',
  to: today,
});
assert.deepEqual(revenuePeriod('Last 7 days', '2026-01-03'), {
  from: '2025-12-28',
  to: '2026-01-03',
});
assert.deepEqual(revenuePeriod('Last 3 months', '2024-02-29'), {
  from: '2023-12-01',
  to: '2024-02-29',
});
assert.deepEqual(revenuePeriod('Next year', today), {
  from: '2027-01-01',
  to: '2027-12-31',
});
assert.throws(() => revenuePeriod('Custom', today, '2026-09-02', '2026-09-01'));
assert.throws(
  () =>
    revenueSnapshot(
      data,
      {
        ...filter,
        group: 'Day',
        range: 'Custom',
        from: '2020-01-01',
        to: '2026-01-01',
      },
      today,
    ),
  /400/,
);
for (const group of ['Day', 'Week', 'Month', 'Quarter', 'Year'])
  assert.equal(
    revenueSnapshot(
      data,
      {
        ...filter,
        group,
        range: 'Custom',
        from: '2026-09-01',
        to: '2026-09-30',
      },
      today,
    ).total.total,
    15000,
  );
assert.deepEqual(
  recentlyBooked(data).map((e) => e.id),
  ['active'],
);
const old = event('legacy', 10000, {
  operations: {},
  created_at: '2026-09-01T12:00:00Z',
});
assert.equal(
  revenueSnapshot(
    { ...data, events: [old], payments: [] },
    { ...filter, basis: 'Booked' },
    today,
  ).fallbackCount,
  1,
);
assert.equal(
  JSON.stringify(data),
  original,
  'Calculations must not mutate saved records',
);
assert.deepEqual(checkedDashboard(defaultDashboard()), defaultDashboard());
const bad = defaultDashboard();
bad.widgets[0].limit = 0;
assert.throws(() => checkedDashboard(bad));
const duplicate = defaultDashboard();
duplicate.widgets[1] = duplicate.widgets[0];
assert.throws(() => checkedDashboard(duplicate));
assert.throws(() => checkedDashboard({ widgets: [] }));
console.log(
  'PASS: revenue date bases, cash vs booked value, installments, tips, overpayment, lifecycle exclusions, timezone boundaries, empty periods, date grouping, recent booking order and layout validation. No business records were changed.',
);
