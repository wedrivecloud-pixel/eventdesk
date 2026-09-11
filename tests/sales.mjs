import assert from 'node:assert/strict';
const base = 'http://localhost:3000',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  },
  suffix = 'Sales QA ' + Date.now();
let taskWatch;
async function call(path, body, auth = true, extra = {}) {
  const r = await fetch(base + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(auth ? headers : { 'Content-Type': 'application/json' }),
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: r.status, data };
}
async function ok(path, body) {
  const r = await call(path, body);
  assert.equal(r.status, 200, JSON.stringify(r));
  if(taskWatch&&r.data.events){
    const event=r.data.events.find(e=>e.id===taskWatch.eventId);
    assert.ok(event?.operations.tasks?.some(t=>t.id===taskWatch.id),`Checklist must survive ${path}:${body?.action||'read'}`);
  }
  return r.data;
}
const initial = await ok('crm'),
  created = [],
  events = [],
  resources = [],
  rules = [],
  flex = initial.resources.filter((r) => r.kind === 'flex' && !r.archived);
let pack;
async function saveRecord(kind, data) {
  const d = await ok('sales', { action: 'save_record', kind, data }),
    r = d.sales.find(
      (r) =>
        r.kind === kind &&
        !created.includes(r.id) &&
        !initial.sales.some((i) => i.id === r.id),
    );
  assert.ok(r);
  created.push(r.id);
  return r;
}
async function resource(kind, name, data) {
  const d = await ok('manage', { action: 'save_resource', kind, name, data }),
    r = d.resources.find((r) => r.kind === kind && r.name === name);
  resources.push(r.id);
  return r;
}
async function event(day, time = '10:00') {
  const title = suffix + ' event ' + events.length,
    d = await ok('crm', {
      action: 'save_event',
      title,
      client: 'Sample Sales Client',
      email: 'sales-qa@example.com',
      date: day,
      time,
      packageIds: [pack.id],
      deposit: 2000,
    }),
    e = d.events.find((e) => e.title === title);
  events.push(e.id);
  return e;
}
try {
  assert.equal(
    (
      await call(
        'sales',
        {
          action: 'save_record',
          kind: 'task',
          data: { title: 'Unauthorized' },
        },
        false,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call(
        'sales',
        { action: 'save_record', kind: 'task', data: { title: 'Bad origin' } },
        true,
        { Origin: 'https://untrusted.example' },
      )
    ).status,
    403,
  );
  for (const r of flex)
    await ok('manage', {
      action: 'archive_resource',
      id: r.id,
      archived: true,
    });
  for (const [group, data] of [
    ['pricing', { taxRate: 0, travelBase: 0, mileRate: 0 }],
    ['availability', { dailyLimit: 0, noticeDays: 0, blackoutDates: '' }],
  ])
    await ok('manage', { action: 'save_settings', group, data });
  const pd = await ok('crm', {
    action: 'save_package',
    name: suffix,
    service: initial.business.services[0],
    price: 10000,
    duration: '1 hour',
    description: 'Local sales regression package',
  });
  pack = pd.packages.find((p) => p.name === suffix);
  const member = await resource('staff', suffix + ' staff', {
    email: 'staff-qa@example.com',
    role: 'Staff',
    rate: 25,
  });
  const e = await event('2045-06-15');
  const appointment = await saveRecord('appointment', {
    title: suffix,
    name: 'Sales Client',
    email: 'sales-qa@example.com',
    date: '2045-06-14',
    time: '10:30',
    minutes: 30,
    staffIds: [member.id],
    eventId: e.id,
    organizer: 'owner',
  });
  let d = await ok('sales', {
    action: 'save_record',
    kind: 'appointment',
    id: appointment.id,
    updatedAt: appointment.updated_at,
    data: {
      ...appointment.data,
      title: suffix + ' edited',
      status: 'Canceled',
    },
  });
  assert.equal(
    d.sales.find((r) => r.id === appointment.id).data.status,
    'Canceled',
  );
  assert.equal(
    (
      await call('sales', {
        action: 'save_record',
        kind: 'appointment',
        id: appointment.id,
        updatedAt: appointment.updated_at,
        data: appointment.data,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call('sales', {
        action: 'save_record',
        kind: 'appointment',
        data: { ...appointment.data, eventId: 'foreign-event' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('sales', {
        action: 'save_record',
        kind: 'time_off',
        data: {
          staffId: 'foreign-staff',
          start: '2045-06-15',
          end: '2045-06-16',
        },
      })
    ).status,
    400,
  );
  const task = await saveRecord('task', {
    title: suffix + ' task',
    due: '2045-06-01',
    assignee: 'owner',
    eventId: e.id,
    notes: 'Preparation',
  });
  d = await ok('sales', {
    action: 'save_record',
    kind: 'task',
    id: task.id,
    updatedAt: task.updated_at,
    data: { ...task.data, done: true },
  });
  assert.equal(d.sales.find((r) => r.id === task.id).data.done, true);
  const template = await resource('checklists', suffix + ' checklist', {
    body: 'Set up lighting\nPack camera',
  });
  d = await ok('manage', {
    action: 'apply_template',
    eventId: e.id,
    templateId: template.id,
  });
  const taskId = d.events.find((x) => x.id === e.id).operations.tasks[0].id;
  taskWatch={eventId:e.id,id:taskId};
  d = await ok('sales', {
    action: 'legacy_task',
    eventId: e.id,
    id: taskId,
    done: true,
  });
  assert.equal(
    d.events.find((x) => x.id === e.id).operations.tasks[0].done,
    true,
  );
  const msg = await saveRecord('message', {
    eventId: e.id,
    recipient: e.email,
    channel: 'Email',
    subject: suffix,
    body: 'Draft only',
    state: 'Awaiting Review',
  });
  d = await ok('sales', {
    action: 'save_record',
    kind: 'message',
    id: msg.id,
    updatedAt: msg.updated_at,
    data: { ...msg.data, state: 'Reviewed' },
  });
  assert.equal(d.sales.find((r) => r.id === msg.id).data.state, 'Reviewed');
  assert.equal(
    (
      await call('sales', {
        action: 'save_record',
        kind: 'message',
        data: { ...msg.data, state: 'Sent' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('sales', {
        action: 'save_record',
        kind: 'message',
        data: { ...msg.data, state: 'Scheduled draft' },
      })
    ).status,
    400,
  );
  await saveRecord('message', {
    ...msg.data,
    state: 'Scheduled draft',
    scheduledDate: '2045-06-13',
    scheduledTime: '09:30',
  });
  const exp = {
    payee: suffix + ' vendor',
    amount: 12345,
    date: '2026-08-01',
    category: 'Equipment',
    reference: suffix,
    notes: 'Local receipt',
    eventId: e.id,
  };
  d = await ok('sales', { action: 'save_expense', data: exp });
  const expense = d.resources.find((r) => r.name === exp.payee);
  resources.push(expense.id);
  assert.equal(expense.data.amount, 123.45);
  const before = d.resources.filter((r) => r.kind === 'expenses').length;
  assert.equal(
    (
      await call('sales', {
        action: 'import_expenses',
        rows: [
          { ...exp, payee: suffix + ' valid' },
          { ...exp, amount: -1 },
        ],
      })
    ).status,
    400,
  );
  assert.equal(
    (await ok('crm')).resources.filter((r) => r.kind === 'expenses').length,
    before,
  );
  d = await ok('sales', {
    action: 'import_expenses',
    rows: [{ ...exp, payee: suffix + ' imported', amount: 999 }],
  });
  resources.push(d.resources.find((r) => r.name === suffix + ' imported').id);
  const png = new Uint8Array(32);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const upload = await fetch(
    base + `/api/sales/files?record=${expense.id}&name=qa-receipt.png`,
    {
      method: 'PUT',
      headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
      body: png,
    },
  );
  assert.equal(upload.status, 200);
  const file = (await upload.json()).files[0];
  assert.equal(
    (await fetch(base + '/api/sales/files?id=' + file.id)).status,
    404,
  );
  assert.equal(
    (
      await fetch(base + '/api/sales/files?id=' + file.id, {
        headers: { Cookie: headers.Cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(
        base + '/api/sales/files?record=foreign-expense&name=test.png',
        {
          method: 'PUT',
          headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
          body: png,
        },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await fetch(base + `/api/sales/files?record=${expense.id}&name=bad.png`, {
        method: 'PUT',
        headers: { Cookie: headers.Cookie, 'Content-Type': 'image/png' },
        body: 'not an image',
      })
    ).status,
    400,
  );
  const rule = await saveRecord('expense_rule', {
    name: suffix + ' monthly',
    repeat: 'Monthly',
    start: '2026-01-31',
    end: '2026-03-31',
    payeeMode: 'Custom',
    payee: suffix + ' recurring',
    amount: 500,
    category: 'Software',
    reference: suffix + ' rule',
    packageIds: [],
  });
  rules.push(rule.id);
  d = await ok('crm');
  let generated = d.resources.filter((r) => r.data.ruleId === rule.id);
  resources.push(...generated.map((r) => r.id));
  assert.deepEqual(generated.map((r) => r.data.date).sort(), [
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
  ]);
  assert.equal(
    (await ok('crm')).resources.filter((r) => r.data.ruleId === rule.id).length,
    3,
  );
  await saveRecord('saved_report', {
    name: suffix + ' report',
    report: 'Payment History',
    from: '2026-01-01',
    to: '2026-12-31',
    status: 'All',
    group: 'Packages',
    search: '',
  });
  await ok('sales', {
    action: 'event_meta',
    id: e.id,
    data: {
      heat: 'Hot',
      review: true,
      signature: 'Recorded',
      signatureDate: '2026-09-01',
      notes: 'Reviewed',
      followUp: '2045-06-01',
    },
  });
  await ok('crm', { action: 'advance_event', id: e.id, status: 'proposal' });
  await ok('manage', {
    action: 'save_planning',
    eventId: e.id,
    staffIds: [member.id],
  });
  const off = await saveRecord('time_off', {
    staffId: member.id,
    start: e.date,
    end: e.date,
    status: 'Approved',
  });
  assert.equal(
    (
      await call('crm', {
        action: 'advance_event',
        id: e.id,
        status: 'confirmed',
      })
    ).status,
    400,
  );
  await ok('sales', {
    action: 'archive_record',
    id: off.id,
    updatedAt: off.updated_at,
    archived: true,
  });
  await ok('crm', { action: 'advance_event', id: e.id, status: 'confirmed' });
  const overlap = await event(e.date, '10:30');
  await ok('crm', {
    action: 'advance_event',
    id: overlap.id,
    status: 'proposal',
  });
  await ok('manage', {
    action: 'save_planning',
    eventId: overlap.id,
    staffIds: [member.id],
  });
  assert.equal(
    (
      await call('crm', {
        action: 'advance_event',
        id: overlap.id,
        status: 'confirmed',
      })
    ).status,
    400,
  );
  d = await ok('manage', {
    action: 'record_payment',
    eventId: e.id,
    amount: 9000,
    tip: 1500,
    method: 'Cash',
    date: '2026-09-01',
    reference: suffix,
  });
  assert.equal(d.payments.find((r) => r.reference === suffix).tip, 1500);
  assert.equal(d.events.find((x) => x.id === e.id).total, 10000);
  const race = await Promise.all([
    call('manage', {
      action: 'record_payment',
      eventId: e.id,
      amount: 1000,
      tip: 0,
      method: 'Cash',
      date: '2026-09-02',
      reference: suffix + ' A',
    }),
    call('manage', {
      action: 'record_payment',
      eventId: e.id,
      amount: 1000,
      tip: 0,
      method: 'Cash',
      date: '2026-09-02',
      reference: suffix + ' B',
    }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
  await ok('manage', {
    action: 'record_payment',
    eventId: e.id,
    amount: 0,
    tip: 500,
    method: 'Cash',
    date: '2026-09-02',
    reference: suffix + ' tip only',
  });
  assert.equal(
    (
      await call('sales', {
        action: 'event_lifecycle',
        ids: [e.id, 'foreign-event'],
        lifecycle: 'Canceled',
      })
    ).status,
    400,
  );
  assert.equal(
    (await ok('crm')).events.find((x) => x.id === e.id).lifecycle,
    'Active',
  );
  await ok('manage', {
    action: 'save_settings',
    group: 'availability',
    data: { dailyLimit: 1, noticeDays: 0, blackoutDates: '' },
  });
  assert.equal(
    (
      await call('crm', {
        action: 'advance_event',
        id: overlap.id,
        status: 'confirmed',
      })
    ).status,
    400,
  );
  await ok('sales', {
    action: 'event_lifecycle',
    ids: [e.id],
    lifecycle: 'Canceled',
  });
  assert.equal(
    (
      await call('crm', {
        action: 'advance_event',
        id: e.id,
        status: 'confirmed',
      })
    ).status,
    400,
  );
  await ok('crm', {
    action: 'advance_event',
    id: overlap.id,
    status: 'confirmed',
  });
  d = await ok('sales', {
    action: 'event_lifecycle',
    ids: [e.id],
    lifecycle: 'Active',
  });
  assert.equal(d.events.find((x) => x.id === e.id).status, 'proposal');
  assert.equal(
    d.payments
      .filter((p) => p.event_id === e.id)
      .reduce((n, p) => n + p.amount, 0),
    10000,
  );
  assert.equal(
    (
      await call('crm', {
        action: 'advance_event',
        id: e.id,
        status: 'confirmed',
      })
    ).status,
    400,
  );
  await ok('sales', {
    action: 'legacy_task_data',
    eventId: e.id,
    id: taskId,
    data: {
      title: 'Updated checklist task',
      due: '2045-06-01',
      assignee: 'owner',
      notes: 'Bring lighting',
      done: true,
    },
  });
  const legacy = (await ok('crm')).events.find((x) => x.id === e.id).operations
    .tasks[0];
  assert.equal(legacy.assignee, 'owner');
  assert.equal(legacy.notes, 'Bring lighting');
  await ok('manage', {
    action: 'save_settings',
    group: 'availability',
    data: { dailyLimit: 0, noticeDays: 0, blackoutDates: '' },
  });
  const first = await event('2046-06-15'),
    second = await event('2046-06-15');
  for (const row of [first, second]) {
    await ok('crm', {
      action: 'advance_event',
      id: row.id,
      status: 'proposal',
    });
    await ok('manage', {
      action: 'save_planning',
      eventId: row.id,
      staffIds: [member.id],
    });
  }
  const staffRace = await Promise.all(
    [first, second].map((row) =>
      call('crm', { action: 'advance_event', id: row.id, status: 'confirmed' }),
    ),
  );
  assert.deepEqual(
    staffRace.map((r) => r.status).sort(),
    [200, 400],
    'Concurrent staffing confirmation must not overlap',
  );
  const newProposal = await ok('crm', {
    action: 'save_event',
    initialStatus: 'proposal',
    title: suffix + ' direct proposal',
    client: 'Client',
    email: 'client@example.com',
    date: '2046-07-01',
    time: '12:00',
    packageIds: [pack.id],
  });
  const proposalRow = newProposal.events.find(
    (x) => x.title === suffix + ' direct proposal',
  );
  events.push(proposalRow.id);
  assert.equal(proposalRow.status, 'proposal');
  console.log(
    'PASS Sales: appointments, stale-edit protection, task/checklist persistence, draft-only message states, expense import atomicity, private receipt files, recurring month-end generation and idempotency, report presets, staff time off/overlap, tips and atomic balances, tenant isolation, lifecycle history and released capacity.',
  );
} finally {
  taskWatch=undefined;
  const d = await ok('crm');
  for (const id of rules) {
    const r = d.sales.find((r) => r.id === id);
    if (r && !r.archived)
      await ok('sales', {
        action: 'archive_record',
        id,
        updatedAt: r.updated_at,
        archived: true,
      });
  }
  for (const id of created.filter((id) => !rules.includes(id))) {
    const r = (await ok('crm')).sales.find((r) => r.id === id);
    if (r && !r.archived)
      await ok('sales', {
        action: 'archive_record',
        id,
        updatedAt: r.updated_at,
        archived: true,
      });
  }
  for (const id of resources)
    await ok('manage', { action: 'archive_resource', id, archived: true });
  if (events.length)
    await ok('sales', {
      action: 'event_lifecycle',
      ids: events,
      lifecycle: 'Archived',
    });
  for (const group of ['pricing', 'availability'])
    await ok('manage', {
      action: 'save_settings',
      group,
      data: initial.settings,
    });
  for (const r of flex)
    await ok('manage', {
      action: 'archive_resource',
      id: r.id,
      archived: false,
    });
  if (pack)
    await ok('crm', {
      action: 'save_package',
      ...pack,
      settings: { ...pack.settings, status: 'Disabled' },
    });
}
