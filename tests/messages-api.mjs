import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.QA_BASE_URL || 'http://localhost:3100',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  },
  tag = 'Message QA ' + Date.now();
async function call(body, path = 'manage', auth = true) {
  const res = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}
async function ok(body, path) {
  const r = await call(body, path);
  assert.equal(r.status, 200, r.data.error || 'Request failed');
  return r.data;
}
const initial = await ok(undefined, 'crm');
assert.equal(
  initial.business.id,
  'qa-business',
  'Only run against the local Sample Event Studio',
);
const resources = [],
  salesIds = [],
  eventIds = [];
let packageId,
  systemEdited = false;
const systemKey = 'send-gallery',
  previousSystem = initial.resources.find(
    (r) => r.kind === 'system_templates' && r.data.systemKey === systemKey,
  );
const det = (patch = {}) =>
  JSON.stringify({
    version: 1,
    packageMode: 'all',
    packageIds: [],
    includedPackageIds: [],
    images: [],
    videos: [],
    attachments: [],
    fields: [],
    tabs: ['General'],
    conditions: [],
    days: [0, 1, 2, 3, 4, 5, 6],
    leadFields: [],
    tags: [],
    requiredAddonIds: [],
    ...patch,
  });
async function resource(kind, suffix, data) {
  const j = await ok({
      action: 'save_resource',
      kind,
      name: tag + suffix,
      data,
    }),
    r = j.resources.find((r) => r.name === tag + suffix);
  resources.push(r.id);
  return r;
}
try {
  assert.equal(
    (
      await call(
        {
          action: 'save_resource',
          kind: 'automations',
          name: 'Unauthorized',
          data: {},
        },
        'manage',
        false,
      )
    ).status,
    401,
  );
  const pd = await ok(
    {
      action: 'save_package',
      name: tag + ' Package',
      service: initial.business.services[0],
      price: 10000,
      duration: '1 hour',
      description: 'Temporary local validation fixture',
    },
    'crm',
  );
  packageId = pd.packages.find((p) => p.name === tag + ' Package').id;
  let j = await ok(
      {
        action: 'save_event',
        title: tag + ' Event',
        client: 'Message Test Client',
        email: 'message-test@example.com',
        phone: '+15550001111',
        date: '2045-08-22',
        time: '12:00',
        packageIds: [packageId],
        deposit: 2000,
      },
      'crm',
    ),
    event = j.events.find((e) => e.title === tag + ' Event');
  eventIds.push(event.id);
  j = await ok(
    { action: 'advance_event', id: event.id, status: 'proposal' },
    'crm',
  );
  assert.ok(
    j.events.find((e) => e.id === event.id).operations.sales.proposalCreatedAt,
  );
  j = await ok(
    { action: 'advance_event', id: event.id, status: 'confirmed' },
    'crm',
  );
  event = j.events.find((e) => e.id === event.id);
  assert.ok(event.operations.sales.confirmedAt);
  const confirmedAt = event.operations.sales.confirmedAt;
  // Updating booking details must not change the date it was secured.
  j = await ok(
    {
      action: 'save_event',
      id: event.id,
      title: event.title,
      client: event.client,
      email: event.email,
      phone: event.phone,
      date: event.date,
      time: event.time,
      packageIds: [packageId],
      deposit: event.deposit,
      notes: 'Verification edit',
    },
    'crm',
  );
  assert.equal(
    j.events.find((e) => e.id === event.id).operations.sales.confirmedAt,
    confirmedAt,
  );
  const paused = await resource('automations', ' Paused Booked Date', {
    eventTrigger: 'Booked Date',
    timing: 'After',
    offset: 2,
    timeUnit: 'Hours',
    enabled: false,
    reviewBeforeSending: true,
    recipientRoles: 'Client|My business',
    subject: 'Secured {{booked_date}}',
    body: 'Hello {{client_first_name}}',
    details: det(),
  });
  assert.equal(paused.data.enabled, false);
  assert.equal(paused.data.eventTrigger, 'Booked Date');
  assert.equal(paused.data.offset, 2);
  assert.equal(
    (
      await call({
        action: 'prepare_message_drafts',
        templateId: paused.id,
        contextId: 'event:' + event.id,
        requestId: randomUUID(),
      })
    ).status,
    400,
  );
  for (const patch of [
    { timing: 'Before' },
    { timing: 'After', offset: 0 },
    { eventTrigger: 'Unknown' },
    {
      details: det({
        conditions: [{ field: 'Unsupported', operator: 'Is', value: 'x' }],
      }),
    },
    {
      details: det({
        packageIds: ['other-business-package'],
        packageMode: 'selected',
      }),
    },
  ])
    assert.equal(
      (
        await call({
          action: 'save_resource',
          kind: 'automations',
          id: paused.id,
          name: paused.name,
          data: { ...paused.data, ...patch },
        })
      ).status,
      400,
    );
  j = await ok({ action: 'duplicate_resource', id: paused.id });
  const copy = j.resources.find((r) => r.name === paused.name + ' (copy)');
  resources.push(copy.id);
  assert.equal(copy.data.enabled, false);
  const custom = await resource('messages', ' Custom', {
    category: 'Bookings',
    channel: 'Email',
    recipientRoles: 'Client|My business',
    subject: 'Booked {{booked_date}}',
    body: 'Hello {{recipient_first_name}}, {{event_title}} is confirmed.',
    details: det(),
  });
  const req = {
    action: 'prepare_message_drafts',
    templateId: custom.id,
    contextId: 'event:' + event.id,
    requestId: randomUUID(),
  };
  const clientLink = await ok(
    { action: 'share_link', eventId: event.id },
    'proposal',
  );
  const expanded = await resource('messages', ' Expanded confirmation', {
    category: 'Bookings',
    channel: 'Email',
    recipientRoles: 'Client',
    subject: 'Booking {{event_title}}',
    body: '{{package_description}}\n{{event_hours}}\n{{add_on_list_with_descriptions}}\n{{venue_address}}\n{{coupon_code}}\n{{event_link}}\n{{invoice_link}}',
    details: det(),
  });
  j = await ok({
    ...req,
    templateId: expanded.id,
    requestId: randomUUID(),
    values: {
      event_link: 'https://wrong.example/override',
      package_description: 'Incorrect catalog copy',
    },
  });
  const expandedDraft = j.sales.find(
    (r) => r.kind === 'message' && r.data.templateId === expanded.id,
  );
  salesIds.push(expandedDraft.id);
  assert.equal(expandedDraft.data.state, 'Awaiting Review');
  assert.ok(
    expandedDraft.data.body.includes('Temporary local validation fixture'),
  );
  assert.ok(
    expandedDraft.data.body.includes(new URL(clientLink.path, base).href),
  );
  assert.ok(
    expandedDraft.data.body.includes(
      new URL(clientLink.path, base).href + '&view=invoice',
    ),
  );
  assert.ok(
    !expandedDraft.data.body.includes('{{') &&
      !expandedDraft.data.body.includes('wrong.example') &&
      !expandedDraft.data.body.includes('Incorrect catalog'),
  );
  await ok({ action: 'revoke_link', eventId: event.id }, 'proposal');
  assert.equal(
    (await call({ ...req, templateId: expanded.id, requestId: randomUUID() }))
      .status,
    400,
    'Revoked links must not fill into a fresh draft',
  );
  j = await ok(req);
  const drafts = j.sales.filter(
    (r) => r.kind === 'message' && r.data.templateId === custom.id,
  );
  salesIds.push(...drafts.map((r) => r.id));
  assert.equal(drafts.length, 2);
  assert.ok(
    drafts.every(
      (r) => r.data.state === 'Awaiting Review' && !r.data.body.includes('{{'),
    ),
  );
  assert.ok(
    drafts
      .find((r) => r.data.recipient === event.email)
      .data.body.startsWith('Hello Message,'),
  );
  j = await ok(req);
  assert.equal(
    j.sales.filter(
      (r) => r.kind === 'message' && r.data.templateId === custom.id,
    ).length,
    2,
    'Retries cannot create duplicate drafts',
  );
  assert.equal(
    (
      await call({
        ...req,
        requestId: randomUUID(),
        contextId: 'event:foreign-event',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call({
        ...req,
        requestId: randomUUID(),
        templateId: 'foreign-template',
      })
    ).status,
    400,
  );
  const sms = await resource('messages', ' SMS', {
    category: 'Bookings',
    channel: 'SMS',
    subject: '',
    recipientRoles: 'Client',
    body: 'Your booking was secured on {{booked_date}}.',
    details: det(),
  });
  j = await ok({ ...req, templateId: sms.id, requestId: randomUUID() });
  const sd = j.sales.find((r) => r.data.templateId === sms.id);
  salesIds.push(sd.id);
  assert.equal(sd.data.channel, 'SMS');
  assert.equal(sd.data.state, 'Awaiting Review');
  assert.equal(sd.data.recipient, event.phone);
  const unresolved = await resource('messages', ' Missing link', {
    category: 'Bookings',
    subject: 'Gallery',
    body: '{{event_photo_album_link}}',
    details: det(),
  });
  assert.equal(
    (await call({ ...req, templateId: unresolved.id, requestId: randomUUID() }))
      .status,
    400,
  );
  assert.equal(
    (
      await call({
        ...req,
        templateId: unresolved.id,
        requestId: randomUUID(),
        values: { event_photo_album_link: 'javascript:alert(1)' },
      })
    ).status,
    400,
  );
  const beforeSystemCount = initial.resources.filter(
    (r) => r.kind === 'system_templates',
  ).length;
  j = await ok({
    action: 'save_system_template',
    systemKey,
    data: {
      subject: 'QA gallery {{event_title}}',
      body: 'Gallery {{event_photo_album_link}}',
      channel: 'SMS',
      category: 'Leads',
    },
  });
  systemEdited = true;
  const system = j.resources.find(
    (r) => r.kind === 'system_templates' && r.data.systemKey === systemKey,
  );
  assert.equal(system.data.channel, 'Email');
  assert.equal(system.data.category, 'Bookings');
  assert.equal(system.name, 'Send Gallery');
  j = await ok({
    action: 'save_system_template',
    systemKey,
    data: {
      subject: 'QA gallery updated',
      body: 'Gallery {{event_photo_album_link}}',
    },
  });
  assert.equal(
    j.resources.filter(
      (r) => r.kind === 'system_templates' && r.data.systemKey === systemKey,
    ).length,
    1,
  );
  assert.equal(
    (await call({ action: 'duplicate_resource', id: system.id })).status,
    400,
  );
  assert.equal(
    (await call({ action: 'delete_resource', id: system.id })).status,
    400,
  );
  assert.equal(
    (await call({ action: 'archive_resource', id: system.id, archived: true }))
      .status,
    400,
  );
  assert.equal(
    (
      await call({
        action: 'save_system_template',
        systemKey: 'unknown',
        data: {},
      })
    ).status,
    400,
  );
  const reload = await ok(undefined, 'crm');
  assert.equal(
    reload.resources.find((r) => r.id === system.id).data.subject,
    'QA gallery updated',
  );
  console.log(
    'PASS: local paused-rule CRUD, duplicate, timing validation, confirmation timestamps, custom Email/SMS drafts, recipient-specific rendering, retry safety, missing values, tenant ownership, immutable system identities, persistence and restore. No delivery invoked.',
  );
} finally {
  if (systemEdited)
    await ok(
      previousSystem
        ? {
            action: 'save_system_template',
            systemKey,
            data: previousSystem.data,
          }
        : { action: 'reset_system_template', systemKey },
    );
  for (const id of resources.reverse())
    await ok({ action: 'delete_resource', id });
  const current = await ok(undefined, 'crm');
  for (const id of salesIds) {
    const r = current.sales.find((x) => x.id === id);
    if (r && !r.archived)
      await ok(
        {
          action: 'archive_record',
          id,
          updatedAt: r.updated_at,
          archived: true,
        },
        'sales',
      );
  }
  if (eventIds.length)
    await ok(
      { action: 'event_lifecycle', ids: eventIds, lifecycle: 'Deleted' },
      'sales',
    );
  if (packageId)
    await ok(
      { action: 'delete_packages', ids: [packageId], confirm: 'DELETE' },
      'packages',
    );
}
