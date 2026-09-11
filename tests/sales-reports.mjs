import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const out = resolve('work/sales-unit');
await mkdir(out, { recursive: true });
for (const name of ['sales', 'sales-reports', 'package-pricing', 'staffing']) {
  const text = await readFile(`lib/${name}.ts`, 'utf8'),
    js = ts
      .transpileModule(text, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(
        /from '(.\/[^']+)'/g,
        (_, path) => `from '${path}.mjs'`,
      );
  await writeFile(`${out}/${name}.mjs`, js);
}
const { csvText, parseCsv, coverage, balance } = await import(
  pathToFileURL(`${out}/sales.mjs`)
);
const { buildReport, blankReportFilter, reportNames } = await import(
  pathToFileURL(`${out}/sales-reports.mjs`)
);
const { eventWindow, windowsOverlap } = await import(
  pathToFileURL(`${out}/staffing.mjs`)
);
const item = {
    id: 'p',
    name: 'Photo booth',
    service: 'Photobooths',
    price: 10000,
    minutes: 120,
    packageSettings: { requiredStaff: 1 },
  },
  e = {
    id: 'e',
    title: 'Wedding',
    client: 'Client',
    email: 'test@example.com',
    phone: '123',
    date: '2026-10-01',
    time: '23:00',
    status: 'confirmed',
    lifecycle: 'Active',
    items: [item],
    total: 11000,
    deposit: 2000,
    follow_up: '',
    source: 'Referral',
    venue: 'Garden',
    operations: {
      staffIds: ['staff', 'archived-staff'],
      quote: { tax: 1000, taxLabel: 'Tax', dueDate: '2026-09-24', extras: [] },
    },
  };
const data = {
  business: { services: ['Photobooths'] },
  packages: [item],
  events: [
    e,
    { ...e, id: 'deleted', title: 'Trashed event', lifecycle: 'Deleted' },
  ],
  payments: [
    {
      id: 'pay',
      event_id: 'e',
      amount: 5000,
      tip: 1000,
      date: '2026-09-05',
      method: 'Cash',
    },
    {
      id: 'historical',
      event_id: 'deleted',
      amount: 1000,
      tip: 0,
      date: '2026-09-05',
      method: 'Check',
    },
  ],
  resources: [
    { id: 'staff', kind: 'staff', name: 'Staff', archived: 0, data: {} },
    {
      id: 'archived-staff',
      kind: 'staff',
      name: 'Former staff',
      archived: 1,
      data: {},
    },
    {
      id: 'cost',
      kind: 'expenses',
      name: 'Supplier',
      archived: 0,
      data: { amount: 20, date: '2026-09-05' },
    },
    {
      id: 'oldcost',
      kind: 'expenses',
      archived: 1,
      data: { amount: 999, date: '2026-09-05' },
    },
  ],
  sales: [],
  settings: {},
};
assert.equal(balance(e, data), 6000);
assert.deepEqual(coverage(e, data), {
  required: 1,
  assigned: ['staff'],
  missing: 0,
});
const september = {
  ...blankReportFilter,
  from: '2026-09-01',
  to: '2026-09-30',
};
assert.equal(buildReport(data, 'Bookings', september).rows.length, 0);
assert.equal(
  buildReport(data, 'Payment History', september).rows.length,
  2,
  'Trashed event payment history is retained',
);
assert.deepEqual(buildReport(data, 'Profit & Loss', september).rows, [
  ['Recorded payments', 60],
  ['Recorded tips', 10],
  ['Recorded expenses', 20],
  ['Recorded receipts less expenses', 50],
]);
assert.equal(buildReport(data, 'Sales Tax', blankReportFilter).rows[0][3], 10);
assert.equal(
  buildReport(data, 'Balances', blankReportFilter).rows[0].at(-1),
  60,
);
assert.equal(
  buildReport(data, 'Most Frequently Booked', blankReportFilter).rows[0][1],
  1,
);
for (const report of reportNames)
  assert.ok(buildReport(data, report, blankReportFilter).note);
assert.equal(
  buildReport(data, 'Email Event History', blankReportFilter).rows.length,
  0,
);
assert.equal(
  buildReport(data, 'Login History', blankReportFilter).rows.length,
  0,
);
const csv = csvText([['=HYPERLINK("bad")', 'a,b', 'line\nwrap', '"quoted"']]);
assert.ok(csv.startsWith('"\'=HYPERLINK'));
assert.deepEqual(parseCsv(csv), [
  ['\'=HYPERLINK("bad")', 'a,b', 'line\nwrap', '"quoted"'],
]);
assert.throws(() => parseCsv('"unfinished'));
assert.equal(eventWindow(e).end - eventWindow(e).start, 120 * 60000);
assert.equal(
  windowsOverlap(
    eventWindow(e),
    eventWindow({ ...e, date: '2026-10-02', time: '00:30' }),
  ),
  true,
);
assert.equal(
  windowsOverlap(
    eventWindow(e),
    eventWindow({ ...e, date: '2026-10-02', time: '01:00' }),
  ),
  false,
);
const days = {
  ...e,
  time: '',
  items: [
    {
      ...item,
      minutes: 4320,
      packageSettings: { dateMode: 'Date Only', durationUnit: 'Days' },
    },
  ],
};
assert.equal(eventWindow(days).end - eventWindow(days).start, 3 * 86400000);
console.log(
  'PASS report calculations, date filters, historical payments, tips, catalog/report coverage, CSV escaping/parser and cross-midnight/day-range staffing windows.',
);
