import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
const h = {
  Cookie: '__sites_local_auth=1',
  'Content-Type': 'application/json',
};
async function call(path, body) {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: h,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function manage(body) {
  const r = await call('manage', body);
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
}
const suffix = Date.now();
const createdResources=[];
async function resource(kind, data) {
  const d = await manage({
    action: 'save_resource',
    kind,
    name: 'Test ' + kind + ' ' + suffix,
    data,
  });
  const row=d.resources.find((r) => r.name === 'Test ' + kind + ' ' + suffix);createdResources.push(row.id);return row;
}
const baseline=(await call('crm')).data;
const heldFlex=baseline.resources.filter(r=>r.kind==='flex'&&!r.archived);
try{
for(const r of heldFlex)await manage({action:'archive_resource',id:r.id,archived:true});
await manage({
  action: 'save_settings',
  group: 'pricing',
  data: {
    taxLabel: 'Test tax',
    taxRate: 10,
    travelBase: 10,
    freeMiles: 10,
    mileRate: 2,
  },
});
await manage({
  action: 'save_settings',
  group: 'payments',
  data: {
    depositMode: 'Percentage',
    depositValue: 25,
    dueDays: 7,
    paymentInstructions: 'Pay by bank transfer.',
  },
});
const addon = await resource('addons', {
    price: 100,
    description: 'Extra hour',
  }),
  backdrop = await resource('backdrops', { price: 50, description: 'Gold' }),
  discount = await resource('discounts', {
    code: 'TEST20-' + Date.now(),
    mode: 'Percentage',
    amount: 20,
    expires: '',
  }),
  flex = await resource('flex', { day: 'Every day', percent: 10 });
const original = (await call('crm')).data;
// Each run needs its own package: existing packages may override the business deposit.
const packageResult=await call('crm',{action:'save_package',name:'Management fixture '+suffix,service:'Photobooths',price:40000,duration:'4 hours',description:'Synthetic management test',settings:{depositMode:'Business default'}});
assert.equal(packageResult.status,200,JSON.stringify(packageResult.data));
const p=packageResult.data.packages.find(p=>p.name==='Management fixture '+suffix);
// Repeated local runs need their own date for the capacity check.
let fixtureDate = new Date('2028-04-01T12:00:00Z');
while (
  original.events.some((e) => e.date === fixtureDate.toISOString().slice(0, 10))
)
  fixtureDate.setUTCDate(fixtureDate.getUTCDate() + 7);
const eventDate = fixtureDate.toISOString().slice(0, 10);
const dueDate = new Date(fixtureDate);
dueDate.setUTCDate(dueDate.getUTCDate() - 7);
const event = {
  action: 'save_event',
  title: 'Advanced test ' + suffix,
  client: 'Test Client',
  email: 'test@example.com',
  date: eventDate,
  time: '17:00',
  packageIds: [p.id],
  addonIds: [addon.id],
  backdropId: backdrop.id,
  discountId: discount.id,
  miles: 20,
  notes: 'PRIVATE ADVANCED NOTE',
};
let r = await call('crm', event);
assert.equal(r.status, 200, JSON.stringify(r));
let e = r.data.events.find((e) => e.title === event.title);
const subtotal = p.price + 15000,
  adjustment = Math.round(subtotal * 0.1),
  discountAmount = Math.round((subtotal + adjustment) * 0.2),
  tax = Math.round((subtotal + adjustment - discountAmount) * 0.1),
  expected = subtotal + adjustment - discountAmount + tax + 3000;
assert.equal(e.total, expected);
assert.equal(e.deposit, Math.round(expected * 0.25));
assert.equal(e.operations.quote.dueDate, dueDate.toISOString().slice(0, 10));
await manage({
  action: 'save_resource',
  kind: 'flex',
  id: flex.id,
  name: flex.name,
  data: { day: 'Every day', percent: 80 },
});
r = await call('crm', { ...event, id: e.id });
assert.equal(r.status, 200);
assert.equal(
  r.data.events.find((x) => x.id === e.id).total,
  expected,
  'Saved flex rule must not reprice an existing quote',
);
const checklist = await resource('checklists', {
    body: 'Confirm venue\nPack equipment',
  }),
  questions = await resource('questionnaires', { body: 'What is your theme?' }),
  staff = await resource('staff', {
    email: 'staff@example.com',
    role: 'Staff',
  }),
  contract = await resource('contracts', { body: 'Sample business terms.' });
let d = await manage({
  action: 'apply_template',
  eventId: e.id,
  templateId: checklist.id,
});
let task = d.events.find((x) => x.id === e.id).operations.tasks[0];
d = await manage({
  action: 'save_planning',
  eventId: e.id,
  taskId: task.id,
  done: true,
});
assert.equal(
  d.events.find((x) => x.id === e.id).operations.tasks[0].done,
  true,
);
d = await manage({
  action: 'apply_template',
  eventId: e.id,
  templateId: questions.id,
});
const q = d.events.find((x) => x.id === e.id).operations.questions[0];
d = await manage({
  action: 'save_planning',
  eventId: e.id,
  answers: { [q.id]: 'Gold theme' },
  staffIds: [staff.id],
});
assert.equal(
  d.events.find((x) => x.id === e.id).operations.questions[0].answer,
  'Gold theme',
);
await manage({
  action: 'apply_template',
  eventId: e.id,
  templateId: contract.id,
});
await manage({
  action: 'record_payment',
  eventId: e.id,
  amount: 10000,
  method: 'Cash',
  date: '2026-09-05',
  reference: 'LOCAL TEST',
});
r = await call('manage', {
  action: 'record_payment',
  eventId: e.id,
  amount: expected,
  method: 'Cash',
  date: '2026-09-05',
});
assert.equal(r.status, 400);
assert.equal(
  (
    await call('manage', {
      action: 'apply_template',
      eventId: 'foreign-event',
      templateId: checklist.id,
    })
  ).status,
  404,
);
assert.equal(
  (
    await call('manage', {
      action: 'save_planning',
      eventId: e.id,
      staffIds: ['foreign-package'],
    })
  ).status,
  400,
);
assert.equal(
  (
    await call('manage', {
      action: 'save_settings',
      group: 'payments',
      data: { depositMode: 'Percentage', depositValue: 101 },
    })
  ).status,
  400,
);
await manage({
  action: 'save_settings',
  group: 'availability',
  data: { dailyLimit: 1, noticeDays: 0, blackoutDates: eventDate },
});
r = await call('crm', {
  action: 'advance_event',
  id: e.id,
  status: 'proposal',
});
assert.equal(r.status, 200);
r = await call('crm', {
  action: 'advance_event',
  id: e.id,
  status: 'confirmed',
});
assert.equal(r.status, 400);
await manage({
  action: 'save_settings',
  group: 'availability',
  data: { dailyLimit: 1, noticeDays: 0, blackoutDates: '' },
});
assert.equal(
  (
    await call('crm', {
      action: 'advance_event',
      id: e.id,
      status: 'confirmed',
    })
  ).status,
  200,
);
const next = await call('crm', { ...event, title: event.title + ' second' });
const e2 = next.data.events.find((x) => x.title === event.title + ' second');
await call('crm', { action: 'advance_event', id: e2.id, status: 'proposal' });
assert.equal(
  (
    await call('crm', {
      action: 'advance_event',
      id: e2.id,
      status: 'confirmed',
    })
  ).status,
  400,
);
assert.equal(
  (await call('crm', { ...event, id: e.id, date: '2027-04-25' })).status,
  400,
  'Confirmed schedule change requires reopening',
);
const page = await fetch(base + '/proposal/' + e.id, { headers: h });
const html = await page.text();
assert.ok(html.includes('Sample business terms.'));
assert.ok(!html.includes('PRIVATE ADVANCED NOTE'));
const badLogo = await fetch(base + '/api/logo', {
  method: 'PUT',
  headers: { Cookie: h.Cookie, 'Content-Type': 'image/svg+xml' },
  body: '<svg/>',
});
assert.equal(badLogo.status, 400);
for (const rr of [
  addon,
  backdrop,
  discount,
  flex,
  checklist,
  questions,
  staff,
  contract,
])
  await manage({ action: 'archive_resource', id: rr.id, archived: true });
console.log(
  'PASS: settings validation, tax/travel/extras/discount/flex/deposit math, quote snapshots, checklists, questionnaires, contracts, staff assignments, offline payment balance, capacity/blackouts, tenant isolation, private-note exclusion and unsafe logo rejection.',
);
}finally{
 for(const id of createdResources)await manage({action:'archive_resource',id,archived:true});
 for(const r of heldFlex)await manage({action:'archive_resource',id:r.id,archived:false});
 for(const group of ['pricing','payments','availability'])await manage({action:'save_settings',group,data:baseline.settings});
}
