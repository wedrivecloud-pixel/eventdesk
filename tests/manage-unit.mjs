import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const out = resolve('work/manage-unit');
await mkdir(out, { recursive: true });
for (const name of [
  'settings',
  'manage-config',
  'manage-pricing',
  'manage-questions',
  'manage-templates',
  'payment-plans',
  'quote',
]) {
  const s = await readFile(`lib/${name}.ts`, 'utf8');
  await writeFile(
    `${out}/${name}.mjs`,
    ts
      .transpileModule(s, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from '(.\/[^']+)'/g, (_, p) => `from '${p}.mjs'`),
  );
}
const { calculateQuote } = await import(pathToFileURL(`${out}/quote.mjs`)),
  { mergedSettings } = await import(pathToFileURL(`${out}/settings.mjs`)),
  { emptyDetails } = await import(pathToFileURL(`${out}/manage-config.mjs`)),
  { installmentSchedule } = await import(
    pathToFileURL(`${out}/payment-plans.mjs`)
  ),
  { checkedAnswers } = await import(
    pathToFileURL(`${out}/manage-questions.mjs`)
  ),
  { templatePatch } = await import(
    pathToFileURL(`${out}/manage-templates.mjs`)
  );
const r = (id, kind, data = {}, d = {}) => ({
    id,
    kind,
    name: id,
    archived: 0,
    data: { ...data, details: JSON.stringify({ ...emptyDetails(), ...d }) },
  }),
  p = {
    id: 'p',
    name: 'Package',
    price: 10000,
    minutes: 120,
    packageSettings: { includedAddonIds: [] },
  },
  s = mergedSettings({ taxRate: 0, travelBase: 0, mileRate: 0 }),
  a = r(
    'a',
    'addons',
    {
      price: 10,
      maxQuantity: 5,
      pricingMethod: 'Multiply by package hours',
      extensionMinutes: 15,
    },
    { packageMode: 'selected', packageIds: ['p'], includedPackageIds: ['p'] },
  );
const q = calculateQuote([p], [a], s, {
  date: '2027-10-01',
  addonIds: ['a'],
  addonQuantities: { a: 3 },
});
assert.equal(q.extras[0].price, 4000);
assert.equal(q.extras[0].extensionMinutes, 45);
assert.equal(q.total, 14000);
assert.throws(
  () =>
    calculateQuote([p], [a], s, {
      date: '2027-10-01',
      addonIds: ['a'],
      addonQuantities: { a: 6 },
    }),
  /quantity/,
);
assert.throws(
  () =>
    calculateQuote([{ ...p, id: 'x' }], [a], s, {
      date: '2027-10-01',
      addonIds: ['a'],
    }),
  /not offered/,
);
assert.equal(
  calculateQuote(
    [p],
    [{ ...a, data: { ...a.data, price: 500 } }],
    s,
    { date: '2027-10-01', addonIds: ['a'] },
    q,
  ).total,
  14000,
  'snapshot keeps original rate and quantity',
);
const { priceExtra } = await import(pathToFileURL(`${out}/manage-pricing.mjs`));
const backdropCategory = r('backdrop-category', 'categories', {
  ownerKind: 'backdrops',
  price: 35.5,
  leadDays: 4,
});
const backdrop = r('backdrop', 'backdrops', {
  categoryId: backdropCategory.id,
  price: 0,
  inheritPrice: true,
  leadDays: 0,
  inheritLead: true,
});
const backdropContext = { date: '2030-01-20', bookingDate: '2030-01-01' };
const backdropPrice = (
  item,
  packages = [p],
  context = backdropContext,
  previous,
) =>
  priceExtra(
    item,
    [backdropCategory, item],
    packages,
    1,
    context,
    [],
    undefined,
    previous,
  );
const inheritedBackdrop = backdropPrice(backdrop);
assert.equal(
  inheritedBackdrop.price,
  3550,
  'blank backdrop price inherits the category rate',
);
assert.throws(
  () =>
    backdropPrice(backdrop, [p], { ...backdropContext, date: '2030-01-03' }),
  /4 days of lead time/,
);
assert.equal(
  backdropPrice({
    ...backdrop,
    data: { ...backdrop.data, inheritPrice: false, price: 0 },
  }).price,
  0,
  'explicit zero overrides a paid category',
);
assert.equal(
  backdropPrice(
    {
      ...backdrop,
      data: { ...backdrop.data, inheritLead: false, leadDays: 0 },
    },
    [p],
    { ...backdropContext, date: '2030-01-03' },
  ).price,
  3550,
  'No lead time overrides category lead time',
);
const includedBackdrop = {
  ...backdrop,
  data: {
    ...backdrop.data,
    details: JSON.stringify({ ...emptyDetails(), includedPackageIds: [p.id] }),
  },
};
assert.equal(
  backdropPrice(includedBackdrop).price,
  0,
  'selected package includes the backdrop at no charge',
);
assert.equal(
  backdropPrice(includedBackdrop, [{ ...p, id: 'other' }]).price,
  3550,
  'other packages retain the upgrade price',
);
assert.equal(
  backdropPrice(
    {
      ...backdrop,
      data: { ...backdrop.data, price: 100, inheritPrice: false },
    },
    [p],
    backdropContext,
    inheritedBackdrop,
  ).price,
  3550,
  'existing quote keeps the snapshotted backdrop rate',
);
const restrictedBackdrop = {
  ...backdrop,
  data: {
    ...backdrop.data,
    details: JSON.stringify({
      ...emptyDetails(),
      packageMode: 'selected',
      packageIds: [p.id],
    }),
  },
};
assert.throws(
  () => backdropPrice(restrictedBackdrop, [{ ...p, id: 'other' }]),
  /not offered/,
);
const fee = r('fee', 'flex', {
  ruleType: 'Surcharge',
  mode: 'Fixed amount',
  amount: 25,
  scope: 'Complete booking',
  locationType: 'State / province',
  locationValues: 'CA',
  setupLocation: 'Outdoor',
});
assert.equal(
  calculateQuote([p], [fee], s, {
    date: '2027-10-01',
    context: { venueState: 'CA', setupLocation: 'Outdoor' },
  }).adjustment,
  2500,
);
assert.equal(
  calculateQuote([p], [fee], s, {
    date: '2027-10-01',
    context: { venueState: 'NV', setupLocation: 'Outdoor' },
  }).adjustment,
  0,
);
const schedule = installmentSchedule(
  10001,
  1000,
  'Deposit + monthly payments',
  3,
  '2027-01-31',
  '2027-04-30',
);
assert.deepEqual(
  schedule.map((s) => s.date),
  ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'],
);
assert.equal(
  schedule.reduce((n, p) => n + p.amount, 0),
  10001,
);
const fields = [
  {
    id: 'yes',
    label: 'Choose',
    type: 'Dropdown',
    options: ['Yes', 'No'],
    required: true,
  },
  {
    id: 'detail',
    label: 'Details',
    type: 'Text Field',
    required: true,
    conditionField: 'yes',
    conditionValue: 'Yes',
  },
];
assert.deepEqual(checkedAnswers({ yes: 'No', detail: 'hidden' }, fields), {
  yes: 'No',
  detail: '',
});
assert.throws(() => checkedAnswers({ yes: 'Yes' }, fields), /Details/);
assert.throws(() => checkedAnswers({ yes: 'bad' }, fields), /listed/);
const template = r(
    't',
    'questionnaires',
    { body: 'Choose\nDetails' },
    { fields },
  ),
  event = { id: 'e', date: '2027-02-10', items: [p], operations: {} };
const initial = templatePatch(template, event, s);
initial.questions[0].answer = 'No';
const sync = templatePatch(
  template,
  { ...event, operations: initial },
  s,
  true,
);
assert.equal(sync.questions.length, 2);
assert.equal(sync.questions[0].answer, 'No');
assert.equal(sync.questions[1].conditionField, sync.questions[0].id);
console.log(
  'PASS: advanced extra quantities, scope, included units, duration extension, price snapshots, conditional flex rules, calendar-month installments, typed/conditional questions and answer-preserving template sync.',
);
