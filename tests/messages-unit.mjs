import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const out = resolve('work/messages-unit');
await mkdir(out, { recursive: true });
for (const name of [
  'settings',
  'manage-config',
  'message-catalog',
  'message-preview',
  'crm',
]) {
  const src = await readFile('lib/' + name + '.ts', 'utf8');
  await writeFile(
    out + '/' + name + '.mjs',
    ts
      .transpileModule(src, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from '(.\/[^']+)'/g, (_, p) => `from '${p}.mjs'`),
  );
}
const cat = await import(pathToFileURL(out + '/message-catalog.mjs')),
  p = await import(pathToFileURL(out + '/message-preview.mjs')),
  { emptyDetails } = await import(pathToFileURL(out + '/manage-config.mjs')),
  { modules, checkedFields } = await import(
    pathToFileURL(out + '/settings.mjs')
  );
assert.equal(cat.triggers.length, 29);
assert.equal(cat.systemTemplates.length, 11);
assert.ok(cat.triggers.some((t) => t.name === 'Extra Added to Booking'));
for (const t of [
  ...cat.systemTemplates,
  ...cat.customStarters,
  ...cat.automationStarters,
])
  checkedFields(
    cat.normalizedMessage({ id: '', kind: t.kind, data: t.data }).data,
    modules[t.kind].fields,
  );
const event = {
  id: 'e',
  client: 'Taylor Client',
  title: 'Wedding',
  email: 'client@example.com',
  phone: '+15550001111',
  status: 'confirmed',
  lifecycle: 'Active',
  date: '2027-06-20',
  time: '17:00',
  created_at: '2026-08-01T12:00:00Z',
  total: 10000,
  deposit: 2500,
  items: [{ id: 'p', name: 'Photo booth', service: 'Photobooths' }],
  operations: {
    sales: { confirmedAt: '2026-09-06T02:30:00Z' },
    staffIds: ['staff'],
    contract: 'Terms',
  },
};
const data = {
  business: {
    id: 'b',
    name: 'Studio',
    email: 'owner@example.com',
    phone: '+15550002222',
  },
  events: [event],
  packages: [],
  settings: { timezone: 'America/Los_Angeles' },
  payments: [],
  resources: [
    {
      id: 'staff',
      kind: 'staff',
      name: 'Alex Team',
      archived: 0,
      data: { email: 'staff@example.com', phone: '+15550003333' },
    },
  ],
  sales: [],
};
const r = {
  id: 'r',
  kind: 'automations',
  archived: 0,
  name: 'Booking',
  data: {
    eventTrigger: 'Booked Date',
    timing: 'When',
    recipientRoles: 'Client|My business|Assigned staff',
    channel: 'Email',
    subject: '{{event_title}}',
    body: '{{booked_date}}',
  },
};
assert.equal(p.messageSchedule(r, { event }, data).date, '2026-09-05');
assert.equal(p.messageSchedule(r, { event }, data).time, '19:30');
assert.equal(p.messageValues({ event }, data).booked_date, '2026-09-05');
assert.equal(
  p.messageValues({ event: { ...event, status: 'lead' } }, data).booked_date,
  undefined,
);
assert.equal(
  p.messageSchedule(r, { event: { ...event, operations: {} } }, data).date,
  '',
);
assert.equal(
  p.messageSchedule(
    { ...r, data: { ...r.data, timing: 'After', offset: 2, timeUnit: 'Days' } },
    { event },
    data,
  ).date,
  '2026-09-07',
);
assert.equal(
  p.messageSchedule(
    { ...r, data: { ...r.data, timing: 'Manual' } },
    { event },
    data,
  ).date,
  '',
);
assert.equal(
  p
    .offsetInstant(
      new Date('2027-01-31T18:00:00Z'),
      1,
      'Months',
      'America/Los_Angeles',
    )
    .toISOString(),
  '2027-02-28T18:00:00.000Z',
);
assert.equal(
  p
    .offsetInstant(
      new Date('2028-02-29T18:00:00Z'),
      1,
      'Years',
      'America/Los_Angeles',
    )
    .toISOString(),
  '2029-02-28T18:00:00.000Z',
);
assert.equal(
  p
    .offsetInstant(
      new Date('2027-03-13T18:00:00Z'),
      1,
      'Days',
      'America/Los_Angeles',
    )
    .toISOString(),
  '2027-03-14T17:00:00.000Z',
);
assert.equal(
  p.localInstant('2027-03-14', '02:30', 'America/Los_Angeles'),
  undefined,
);
assert.deepEqual(
  p.messageRecipients(r, { event }, data).map((r) => r.address),
  ['client@example.com', 'owner@example.com', 'staff@example.com'],
);
assert.equal(
  p.messageRecipients(
    { ...r, data: { ...r.data, extraRecipients: 'client@example.com' } },
    { event },
    data,
  ).length,
  3,
);
assert.equal(
  p.messageRecipients(
    { ...r, data: { ...r.data, channel: 'SMS' } },
    { event },
    data,
  )[0].address,
  event.phone,
);
const condition = (field, value, operator = 'Is') => ({
  ...r,
  data: {
    ...r.data,
    details: JSON.stringify({
      ...emptyDetails(),
      conditions: [{ field, value, operator }],
    }),
  },
});
assert.equal(
  p.conditionResults(condition('Balance', 'Not fully paid'), { event }, data)[0]
    .matches,
  true,
);
assert.equal(
  p.conditionResults(condition('Balance', 'Unpaid'), { event }, data)[0]
    .matches,
  true,
);
assert.equal(
  p.conditionResults(condition('Balance', '100'), { event }, data)[0].matches,
  true,
);
assert.equal(
  p.conditionResults(condition('Contract', 'Signed'), { event }, data)[0]
    .matches,
  false,
);
assert.equal(
  p.conditionResults(
    condition('Referrals', 'Referred', 'Is not'),
    { event },
    data,
  )[0].matches,
  false,
);
assert.equal(
  p.conditionResults(
    condition('Deposit', 'Paid'),
    { event },
    { ...data, payments: [{ event_id: 'e', amount: 2500 }] },
  )[0].matches,
  true,
);
assert.equal(
  p.messageContexts(r, { ...data, events: [{ ...event, status: 'lead' }] })
    .length,
  0,
);
assert.ok(
  p.messageIssues(
    { ...r, data: { ...r.data, enabled: false } },
    { event },
    data,
  ).length,
);
assert.ok(
  p.messageIssues(
    r,
    { event: { ...event, operations: { sales: { automationsPaused: true } } } },
    data,
  ).length,
);
assert.ok(
  p.messageIssues(r, { event: { ...event, lifecycle: 'Canceled' } }, data)
    .length,
);
assert.equal(
  p.renderMessage(
    '{{booked_date}} {{missing_link}}',
    p.messageValues({ event }, data),
  ).text,
  '2026-09-05 {{missing_link}}',
);
assert.deepEqual(p.renderMessage('{{unknown}}', {}).unresolved, ['unknown']);
assert.equal(
  cat.normalizedMessage({ ...r, data: { trigger: 'Booking confirmed' } }).data
    .eventTrigger,
  'Booked Date',
);
assert.deepEqual(cat.rolesFor({ recipientRoles: 'None' }), []);
const appointment = {
  id: 'a',
  kind: 'appointment',
  archived: 0,
  created_at: '2026-09-05T12:00:00Z',
  data: {
    title: 'Call',
    name: 'Alex Client',
    email: 'a@example.com',
    date: '2026-10-10',
    time: '14:00',
    additional: 'b@example.com',
    staffIds: ['staff'],
  },
};
assert.equal(
  p.messageContexts(
    { ...r, data: { eventTrigger: 'Appointment Created' } },
    { ...data, sales: [appointment] },
  ).length,
  1,
);
assert.equal(
  p.messageRecipients(
    {
      ...r,
      data: {
        recipientRoles: 'Primary attendee|Additional attendees|Assigned staff',
      },
    },
    { appointment },
    data,
  ).length,
  3,
);
// Prefilled automations cover every trigger and start paused. Creating or
// editing one copy cannot mutate the shared starters or another business.
assert.equal(
  new Set(cat.automationStarters.map((t) => t.key)).size,
  cat.automationStarters.length,
);
for (const trigger of cat.triggers) {
  const fresh = cat.newAutomationMessage(trigger.name);
  assert.ok(fresh.name && fresh.data.subject && fresh.data.body.length > 80);
  assert.equal(fresh.data.enabled, false);
  assert.equal(fresh.data.reviewBeforeSending, true);
  assert.ok(cat.rolesFor(fresh.data).length);
  fresh.data.body = 'My own message';
  assert.notEqual(
    cat.newAutomationMessage(trigger.name).data.body,
    fresh.data.body,
  );
}
const tokens = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
for (const t of cat.automationStarters)
  for (const m of (t.data.subject + '\n' + t.data.body).matchAll(tokens))
    assert.ok(
      cat.messageTokens.includes(m[1]),
      `Missing editor token: ${m[1]}`,
    );
const savedVenue = {
  name: 'Garden',
  address: '123 Test St',
  address2: 'Suite 2',
  city: 'Mesa',
  state: 'AZ',
  postalCode: '85201',
  country: 'US',
};
const fullEvent = {
  ...event,
  venue: 'Garden, 123 Test St, Suite 2, Mesa, AZ 85201, US',
  items: [
    {
      ...event.items[0],
      description: 'Reserved package description',
      duration: '4 hr',
    },
  ],
  operations: {
    ...event.operations,
    customerRequest: { venueDetails: savedVenue },
    invoice: { dueOn: '2027-06-10' },
    quote: {
      dueDate: '2027-06-11',
      backdropId: 'backdrop',
      discountRule: { data: { code: 'SUMMER' } },
      extras: [
        {
          id: 'addon',
          kind: 'addons',
          name: 'Album',
          quantity: 2,
          included: true,
          snapshot: { data: { description: 'Reserved album description' } },
        },
        { id: 'backdrop', kind: 'backdrops', name: 'Gold backdrop' },
      ],
    },
  },
};
const link = {
  id: 'link',
  kind: 'proposal_link',
  archived: 0,
  data: { eventId: 'e', token: 'A'.repeat(43) },
};
const fullData = {
  ...data,
  settings: { ...data.settings, signature: 'Your Event Studio\n555-0100' },
  packages: [{ id: 'p', description: 'New catalog description' }],
  sales: [link],
  payments: [{ event_id: 'e', amount: 1500 }],
};
const values = p.messageValues(
  { event: fullEvent },
  fullData,
  undefined,
  'https://eventdesk.example',
);
assert.equal(values.package_description, 'Reserved package description');
assert.equal(values.venue_name, 'Garden');
assert.equal(values.venue_address, '123 Test St\nSuite 2\nMesa, AZ 85201\nUS');
assert.equal(values.event_hours, '4 hr');
assert.equal(
  values.add_on_list_with_descriptions,
  'Album × 2 (included)\nReserved album description',
);
assert.equal(values.backdrop_name, 'Gold backdrop');
assert.equal(values.coupon_code, 'SUMMER');
assert.equal(values.event_balance_due, '$85');
assert.equal(values.event_deposit_due, '$10');
assert.equal(values.event_due_date, '2027-06-10');
assert.equal(values.brand_signature, 'Your Event Studio\n555-0100');
assert.equal(
  values.event_link,
  'https://eventdesk.example/proposal/e?token=' + 'A'.repeat(43),
);
assert.equal(values.invoice_link, values.event_link + '&view=invoice');
for (const key of ['booking-client', 'booking-owner']) {
  const t = cat.automationStarters.find((t) => t.key === key);
  const rendered = p.renderMessage(t.data.body, values);
  assert.deepEqual(rendered.unresolved, []);
  assert.ok(rendered.text.includes('Reserved album description'));
  assert.ok(!rendered.text.includes('New catalog description'));
}
assert.equal(
  p.messageValues(
    { event: { ...fullEvent, venue: 'A different venue' } },
    fullData,
  ).venue_address,
  'Address to be confirmed',
);
assert.equal(
  p.messageValues(
    {
      event: {
        ...fullEvent,
        items: [{ ...fullEvent.items[0], description: '' }],
      },
    },
    fullData,
  ).package_description,
  'No description recorded',
);
assert.equal(
  p.messageValues({ event }, data).add_on_list_with_descriptions,
  'No add-ons recorded',
);
assert.equal(p.messageValues({ event }, data).coupon_code, 'None recorded');
assert.equal(
  p.messageValues({ event }, data).payment_amount,
  undefined,
  'Do not guess which payment triggered a receipt',
);
for (const unsafeSales of [
  [],
  [{ ...link, archived: 1 }],
  [{ ...link, data: { ...link.data, eventId: 'foreign' } }],
  [{ ...link, data: { ...link.data, token: 'invalid' } }],
]) {
  assert.equal(
    p.messageValues(
      { event },
      { ...fullData, sales: unsafeSales },
      undefined,
      'https://eventdesk.example',
    ).event_link,
    undefined,
  );
}
for (const origin of [
  '',
  'javascript:alert(1)',
  'https://user:password@example.com',
  'http://public.example',
])
  assert.equal(
    p.messageValues({ event }, fullData, undefined, origin).event_link,
    undefined,
  );
assert.equal(
  p.messageValues(
    { event: { ...event, lifecycle: 'Deleted' } },
    fullData,
    undefined,
    'https://eventdesk.example',
  ).invoice_link,
  undefined,
);
assert.equal(
  p.messageValues(
    {
      appointment: {
        ...appointment,
        data: { ...appointment.data, location: 'Video call' },
      },
    },
    data,
  ).appointment_location,
  'Video call',
);
console.log(
  'PASS: 29 triggers, 11 system templates, every starter validates; secured-date semantics, legacy compatibility, time zones/DST/calendar offsets, package contexts, conditions, recipients and unresolved placeholders.',
);
