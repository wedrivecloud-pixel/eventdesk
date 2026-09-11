import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = 'http://localhost:3000',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  };
async function call(path, body, auth = true) {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function ok(path, body, auth = true) {
  const r = await call(path, body, auth);
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
}
const initial = await ok('crm'),
  suffix = Date.now(),
  service = initial.business.services[0];
const settings = (group, data) =>
  ok('manage', { action: 'save_settings', group, data });
const flex = initial.resources.filter((r) => r.kind === 'flex' && !r.archived),
  createdEvents = [];
let p;
const body = {
  action: 'save_package',
  name: 'Pricing scheduling QA ' + suffix,
  service,
  price: 80000,
  duration: '4 hr',
  description: 'Local pricing and scheduling test',
  settings: {
    includedMinutes: 240,
    minMinutes: 240,
    maxMinutes: 360,
    increment: 30,
    extraHours: true,
    extraRate: 150,
    availabilityMode: 'Every day',
    unitCalculation: 'Add unit charges',
    unitMode: 'Per unit',
    unitLabel: 'Guest',
    unitTiers: [
      { min: 0, max: 100, rate: 5, included: 20 },
      { min: 101, max: null, rate: 4, included: 20 },
    ],
    depositMode: 'Percentage',
    depositBasis: 'Booking total share',
    depositValue: 25,
  },
};
async function save(s = {}, patch = {}) {
  const d = await ok('crm', {
    ...body,
    id: p?.id,
    ...patch,
    settings: { ...body.settings, ...s },
  });
  p = d.packages.find((x) => x.name === body.name);
  return p;
}
const selection = {
  date: '2028-08-15',
  time: '17:00',
  minutes: 300,
  units: 100,
  addonIds: [],
  backdropId: '',
  discountCode: '',
};
const quote = (patch = {}) =>
  ok(
    'booking',
    { action: 'quote', packageId: p.id, ...selection, ...patch },
    false,
  );
const invalidQuote = async (patch) =>
  assert.equal(
    (
      await call(
        'booking',
        { action: 'quote', packageId: p.id, ...selection, ...patch },
        false,
      )
    ).status,
    400,
  );
const available = (date, minutes) =>
  ok(
    'booking?' +
      new URLSearchParams({ package: p.id, date, minutes: String(minutes) }),
    undefined,
    false,
  );
async function event(date, minutes) {
  const title = 'Range capacity QA ' + suffix + ' ' + createdEvents.length;
  const d = await ok('crm', {
    action: 'save_event',
    title,
    client: 'Local QA',
    email: 'qa@example.com',
    date,
    time: '',
    packageIds: [p.id],
    packageSelections: { [p.id]: { minutes, units: 1 } },
  });
  const e = d.events.find((x) => x.title === title);
  createdEvents.push(e.id);
  return e;
}
async function proposal(e) {
  await ok('crm', { action: 'advance_event', id: e.id, status: 'proposal' });
}
try {
  await settings('pricing', { taxRate: 10, travelBase: 0, mileRate: 0 });
  await settings('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: '',
  });
  for (const r of flex)
    await ok('manage', {
      action: 'archive_resource',
      id: r.id,
      archived: true,
    });
  await save();
  assert.equal(p.settings.unitTiers[1].max, null);
  let q = await quote();
  assert.equal(q.packagePrice, 135000, '$800 + $150 extra hour + (100-20)*$5');
  assert.equal(q.tax, 13500);
  assert.equal(q.deposit, 37125, '25% of total including tax');
  q = await quote({ units: 101 });
  assert.equal(q.packagePrice, 127400, 'second tier uses total quantity');
  q = await quote({ units: 10 });
  assert.equal(
    q.packagePrice,
    95000,
    'included units do not subtract from base',
  );
  await invalidQuote({ units: 100001 });
  await invalidQuote({ units: 2.5 });
  await invalidQuote({ minutes: 271 });
  const ranges = {
    unitMode: 'Per range',
    unitTiers: [
      { min: 1, max: 50, rate: 200, included: 0 },
      { min: 51, max: null, rate: 350, included: 0 },
    ],
  };
  await save(ranges);
  q = await quote({ units: 50 });
  assert.equal(q.packagePrice, 115000);
  q = await quote({ units: 51 });
  assert.equal(q.packagePrice, 130000);
  for (const patch of [
    {
      unitTiers: [
        { min: 0, max: 10, rate: 1, included: 0 },
        { min: 10, max: null, rate: 1, included: 0 },
      ],
    },
    { unitTiers: [] },
    { weekdayHours: [] },
    { slotInterval: 17 },
    { durationUnit: 'Days' },
    { includedDays: 0 },
  ])
    assert.equal(
      (
        await call('crm', {
          ...body,
          id: p.id,
          settings: { ...body.settings, ...patch },
        })
      ).status,
      400,
      JSON.stringify(patch),
    );
  await save({
    unitTiers: [
      { min: 0, max: 10, rate: 1, included: 0 },
      { min: 20, max: null, rate: 1, included: 0 },
    ],
  });
  await invalidQuote({ units: 15 });
  await save({
    unitCalculation: 'Multiply package',
    unitTiers: [],
    depositBasis: 'Package amount',
  });
  q = await quote({ units: 2 });
  assert.equal(q.packagePrice, 190000);
  assert.equal(q.deposit, 47500, 'old percentage basis retained');
  const timing = {
    unitMode: 'None',
    unitTiers: [],
    includedMinutes: 60,
    minMinutes: 60,
    maxMinutes: 120,
    increment: 30,
    picker: 'Automatic slots',
    slotInterval: 120,
    availabilityMode: 'Limited hours',
    startTime: '09:00',
    endTime: '17:00',
  };
  await save(timing);
  let a = await available(selection.date, 60);
  assert.deepEqual(a.times, ['09:00', '11:00', '13:00', '15:00', '17:00']);
  await quote({ minutes: 60 });
  await invalidQuote({ minutes: 60, time: '09:30' });
  await invalidQuote({ minutes: 60, time: '17:01' });
  await save({ ...timing, picker: 'Minimal' });
  await quote({ minutes: 60, time: '09:07' });
  const weekdayHours = Array.from({ length: 7 }, () => ({
    mode: 'Unavailable',
    start: '00:00',
    end: '23:59',
  }));
  weekdayHours[2] = { mode: 'Limited hours', start: '09:00', end: '11:00' };
  weekdayHours[5] = { mode: 'Limited hours', start: '17:00', end: '21:00' };
  await save({ ...timing, availabilityMode: 'By weekday', weekdayHours });
  a = await available('2028-08-15', 60);
  assert.deepEqual(a.times, ['09:00', '11:00']);
  a = await available('2028-08-18', 60);
  assert.deepEqual(a.times, ['17:00', '19:00', '21:00']);
  await invalidQuote({ date: '2028-08-16', minutes: 60 });
  const slots = [
    {
      id: randomUUID(),
      start: '09:00',
      end: '10:00',
      label: 'Morning visit',
      days: [2],
    },
    {
      id: randomUUID(),
      start: '18:00',
      end: '20:00',
      label: 'Evening visit',
      days: [5],
    },
  ];
  await save({
    ...timing,
    picker: 'Predefined slots',
    availabilityMode: 'Every day',
    predefinedSlots: slots,
  });
  a = await available('2028-08-15', 60);
  assert.deepEqual(a.slots, [
    { time: '09:00', label: 'Morning visit', minutes: 60 },
  ]);
  a = await available('2028-08-18', 60);
  assert.deepEqual(a.slots, [
    { time: '18:00', label: 'Evening visit', minutes: 120 },
  ]);
  await quote({ date: '2028-08-18', time: '18:00', minutes: 120 });
  await invalidQuote({ date: '2028-08-18', time: '18:00', minutes: 60 });
  await invalidQuote({ date: '2028-08-15', time: '18:00', minutes: 120 });
  const days = {
    unitMode: 'None',
    unitTiers: [],
    dateMode: 'Date Only',
    durationUnit: 'Days',
    includedDays: 2,
    minDays: 1,
    maxDays: 5,
    extraDays: true,
    dailyRate: 150,
  };
  await save(days);
  q = await quote({ minutes: 4320, time: '' });
  assert.equal(q.packagePrice, 95000);
  assert.equal(q.duration, '3 days');
  await invalidQuote({ minutes: 3000 });
  await invalidQuote({ minutes: 8640 });
  const html = await (await fetch(base + '/book/' + p.id)).text();
  assert.ok(html.includes('2 days'));
  assert.ok(html.includes('day'));
  assert.ok(!html.includes('PRIVATE_'));
  await settings('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: '2028-08-16',
  });
  await invalidQuote({ minutes: 4320, time: '' });
  assert.equal(
    (
      await call(
        'booking?' +
          new URLSearchParams({
            package: p.id,
            date: selection.date,
            minutes: '4320',
          }),
        undefined,
        false,
      )
    ).status,
    400,
  );
  await settings('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: '',
  });
  await save({ ...days, availabilityMode: 'By weekday', weekdayHours });
  await invalidQuote({ minutes: 4320, time: '' });
  await save(days);
  q = await quote({ minutes: 4320, time: '' });
  const request = {
    action: 'submit',
    packageId: p.id,
    ...selection,
    minutes: 4320,
    time: '',
    requestId: randomUUID(),
    firstName: 'Local',
    lastName: 'QA',
    email: 'qa@example.com',
    phone: '555-0100',
    title: 'Day request QA ' + suffix,
    venue: 'Test venue',
    notes: 'Local test',
    acknowledged: true,
    quoteToken: q.token,
  };
  await ok('booking', request, false);
  createdEvents.push(request.requestId);
  let d = await ok('crm');
  const requested = d.events.find((e) => e.id === request.requestId);
  assert.equal(requested.status, 'lead');
  assert.equal(requested.items[0].minutes, 4320);
  await save({ ...days, dailyRate: 999 });
  d = await ok('crm');
  assert.equal(
    d.events.find((e) => e.id === request.requestId).items[0].price,
    95000,
    'saved request keeps pricing snapshot',
  );
  await save(days);
  await settings('availability', {
    dailyLimit: 1,
    noticeDays: 0,
    blackoutDates: '',
  });
  const first = await event('2028-09-11', 4320),
    second = await event('2028-09-12', 2880);
  await proposal(first);
  await proposal(second);
  const race = await Promise.all(
    [first, second].map((e) =>
      call('crm', { action: 'advance_event', id: e.id, status: 'confirmed' }),
    ),
  );
  assert.deepEqual(
    race.map((r) => r.status).sort(),
    [200, 400],
    'overlapping date ranges enforce atomic capacity',
  );
  await invalidQuote({ date: '2028-09-12', minutes: 1440, time: '' });
  await invalidQuote({ date: '2028-09-10', minutes: 4320, time: '' });
  await quote({ date: '2028-09-15', minutes: 1440, time: '' });
  const blocked = await event('2028-10-02', 4320);
  await proposal(blocked);
  await settings('availability', {
    dailyLimit: 1,
    noticeDays: 0,
    blackoutDates: '2028-10-03',
  });
  assert.equal(
    (
      await call('crm', {
        action: 'advance_event',
        id: blocked.id,
        status: 'confirmed',
      })
    ).status,
    400,
  );
  console.log(
    'PASS: additive per-unit/range pricing, included units, legacy quote/deposit preservation, taxed percentage deposit, distinct slot/booking increments, latest-start limits, weekday schedules, labeled start/end slots, day ranges, blackout checks, approval requests, immutable quotes and atomic multi-day capacity.',
  );
} finally {
  const d = await ok('crm');
  for (const id of createdEvents) {
    const e = d.events.find((x) => x.id === id);
    if (e?.status === 'confirmed')
      await ok('crm', { action: 'advance_event', id, status: 'proposal' });
  }
  for (const group of ['pricing', 'availability'])
    await settings(group, initial.settings);
  for (const r of flex)
    await ok('manage', {
      action: 'archive_resource',
      id: r.id,
      archived: false,
    });
  if (p) await save({ ...p.settings, status: 'Disabled' });
}
