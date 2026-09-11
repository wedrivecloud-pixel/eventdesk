import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve('work/staff-tests');
await mkdir(out, { recursive: true });
for (const name of ['crm', 'staff-scheduling'])
  await writeFile(
    `${out}/${name}.mjs`,
    ts
      .transpileModule(await readFile(`lib/${name}.ts`, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from '(.\/[^']+)'/g, (_, p) => `from '${p}.mjs'`),
  );
const {
  defaultWeek,
  defaultCalendar,
  checkedWeek,
  checkedCalendar,
  weeklyAllows,
  wall,
  zonedInstant,
  checkedIntake,
  timeOffWindow,
} = await import(pathToFileURL(`${out}/staff-scheduling.mjs`));
const week = defaultWeek();
week[1] = { mode: 'hours', start: '09:00', end: '17:00' };
week[2] = { mode: 'off', start: '09:00', end: '17:00' };
assert(
  weeklyAllows(week, {
    start: wall('2030-01-07', '09:00'),
    end: wall('2030-01-07', '17:00'),
  }),
);
assert(
  !weeklyAllows(week, {
    start: wall('2030-01-07', '16:30'),
    end: wall('2030-01-07', '17:30'),
  }),
);
assert(
  !weeklyAllows(week, {
    start: wall('2030-01-07', '23:30'),
    end: wall('2030-01-08', '00:30'),
  }),
);
assert.throws(() => checkedWeek([{ ...week[0] }]));
assert.throws(() => checkedCalendar({ ...defaultCalendar(), maxDays: -1 }));
assert(
  Number.isNaN(zonedInstant('2030-03-10', '02:30', 'America/Los_Angeles')),
);
assert.equal(
  new Date(
    zonedInstant('2030-01-07', '09:00', 'America/Los_Angeles'),
  ).toISOString(),
  '2030-01-07T17:00:00.000Z',
);
assert.equal(
  timeOffWindow({
    start: '2030-01-07',
    end: '2030-01-07',
    allDay: false,
    startTime: '10:00',
    endTime: '11:00',
  }).end - wall('2030-01-07', '10:00'),
  3600000,
);
assert.throws(() =>
  checkedIntake(defaultCalendar(), {
    name: 'Test',
    email: 'test@example.com',
    location: 'Phone',
    phone: '5550100',
    additional: Array(6).fill('a@example.com').join(','),
  }),
);
console.log(
  'PASS: weekly boundaries, overnight availability, partial time off, DST gaps, notice conversion and intake validation.',
);
const base = 'http://localhost:3000',
  headers = {
    Cookie: '__sites_local_auth=1',
    'Content-Type': 'application/json',
  },
  prefix = 'Staff Scheduling QA ' + Date.now();
async function call(body, path = 'manage', auth = true) {
  const r = await fetch(`${base}/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function ok(body, path) {
  const r = await call(body, path);
  assert.equal(r.status, 200, r.data.error || JSON.stringify(r.data));
  return r.data;
}
const initial = await ok(undefined, 'crm');
assert.equal(initial.business.id, 'qa-business');
let staff,
  eventId,
  packageId,
  settingsChanged = false,
  cal,
  config = {
    ...defaultCalendar(),
    week: defaultWeek(),
    phoneDirection: 'The invitee will call me',
    phoneDetails: 'Call the office',
    confirmation: 'Approved by the studio.',
  };
const read = () => ok(undefined, 'crm');
async function saveConfig(next) {
  config = next;
  return ok({
    action: 'save_appointment_calendar',
    staffId: staff.id,
    id: cal?.id,
    name: prefix + ' Calendar',
    config,
  });
}
async function times(day = '2030-01-07') {
  const r = await call(
    undefined,
    'appointments?' +
      new URLSearchParams({ staff: staff.id, calendar: cal.id, date: day }),
    false,
  );
  assert.equal(r.status, 200, r.data.error);
  return r.data.times;
}
async function request(name, time = '09:00') {
  return call(
    {
      staff: staff.id,
      calendar: cal.id,
      date: '2030-01-07',
      time,
      answers: {
        name: prefix + ' ' + name,
        email: 'qa@example.com',
        location: 'Phone',
        phone: '5550100',
      },
      acknowledged: true,
      companyWebsite: '',
    },
    'appointments',
    false,
  );
}
try {
  const created = await ok({
    action: 'save_resource',
    kind: 'staff',
    name: prefix,
    data: { email: 'qa@example.com', staffRole: true },
  });
  staff = created.resources.find((r) => r.name === prefix);
  assert.equal(
    (
      await call(
        { action: 'save_staff_availability', staffId: staff.id, week },
        'manage',
        false,
      )
    ).status,
    401,
  );
  assert(
    (
      await call({
        action: 'save_staff_availability',
        staffId: 'foreign',
        week,
      })
    ).status >= 400,
  );
  await ok({ action: 'save_staff_availability', staffId: staff.id, week });
  let j = await saveConfig(config);
  cal = j.resources.find((r) => r.name === prefix + ' Calendar');
  assert((await times()).includes('09:00'));
  assert(!(await times()).includes('17:00'));
  assert.equal((await times('2030-01-08')).length, 0);
  await ok({
    action: 'save_resource',
    kind: 'staff',
    id: staff.id,
    name: prefix,
    data: { phone: '5550200' },
  });
  assert.deepEqual(
    JSON.parse(
      (await read()).resources.find((r) => r.id === staff.id).data
        .bookingAvailability,
    ),
    week,
    'Generic user edit retains weekly hours',
  );
  j = await ok(
    {
      action: 'save_record',
      kind: 'time_off',
      data: {
        staffId: staff.id,
        start: '2030-01-07',
        end: '2030-01-07',
        allDay: false,
        startTime: '10:00',
        endTime: '11:00',
        status: 'Approved',
        notes: prefix,
      },
    },
    'sales',
  );
  const off = j.sales.find(
    (r) => r.kind === 'time_off' && r.data.notes === prefix,
  );
  assert(!(await times()).includes('10:00'));
  assert((await times()).includes('11:00'));
  assert.equal((await request('A')).status, 200);
  assert.equal((await request('B')).status, 200);
  assert(
    (await times()).includes('09:00'),
    'Pending requests do not reserve a slot',
  );
  const requests = (await read()).sales.filter(
    (r) => r.kind === 'appointment' && r.data.calendarId === cal.id,
  );
  const approve = (r) =>
    call(
      {
        action: 'save_record',
        kind: 'appointment',
        id: r.id,
        updatedAt: r.updated_at,
        data: { ...r.data, status: 'Scheduled' },
      },
      'sales',
    );
  const results = await Promise.all(requests.map(approve));
  assert.equal(
    results.filter((r) => r.status === 200).length,
    1,
    'Only one racing approval succeeds',
  );
  let approved = (await read()).sales.find(
    (r) =>
      r.kind === 'appointment' &&
      r.data.calendarId === cal.id &&
      r.data.status === 'Scheduled',
  );
  assert.equal(approved.data.confirmationMessage, config.confirmation);
  assert(approved.data.details.includes('Call the office'));
  assert(!(await times()).includes('09:00'));
  await saveConfig({ ...config, buffer: 30 });
  assert(!(await times()).includes('09:30'));
  assert(!(await times()).includes('10:00'));
  await saveConfig({
    ...config,
    sameWeek: false,
    week: defaultWeek(),
    blockouts: 'None',
  });
  assert(
    (await times('2030-01-08')).includes('09:00'),
    'Calendar can use separate weekly hours',
  );
  assert((await times()).includes('10:00'), 'None ignores staff time off');
  await saveConfig({ ...config, maxDays: 1 });
  assert.equal((await times()).length, 0);
  await saveConfig({ ...config, maxDays: null });
  await ok(
    {
      action: 'archive_record',
      id: approved.id,
      updatedAt: approved.updated_at,
      archived: true,
    },
    'sales',
  );
  approved = (await read()).sales.find((r) => r.id === approved.id);
  await ok(
    {
      action: 'archive_record',
      id: approved.id,
      updatedAt: approved.updated_at,
      archived: false,
    },
    'sales',
  );
  assert.equal(
    (await read()).sales.find((r) => r.id === approved.id).data.status,
    'Pending',
  );
  // Booking assignment guard shares the same weekly/time-off/appointment rules, via an internal appointment.
  const manual = {
    title: prefix + ' Manual',
    name: 'QA',
    email: 'qa@example.com',
    date: '2030-01-08',
    time: '09:00',
    minutes: 30,
    location: 'Phone',
    organizer: staff.id,
    staffIds: [],
    status: 'Scheduled',
  };
  const manualRejected = await call(
    { action: 'save_record', kind: 'appointment', data: manual },
    'sales',
  );
  assert.equal(manualRejected.status, 409);
  assert.match(manualRejected.data.error, /no longer available/);
  assert(
    (
      await call(
        {
          action: 'save_record',
          kind: 'appointment',
          data: { ...manual, date: '2030-01-07', time: '10:00' },
        },
        'sales',
      )
    ).status >= 400,
  );
  await saveConfig({ ...config, notice: 10080 });
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  assert.equal(
    (await times(tomorrow)).length,
    0,
    'Minimum notice blocks near-term requests',
  );
  await saveConfig({
    ...config,
    notice: 0,
    bookings: 'All bookings',
    blockouts: 'All blockout dates',
  });
  await ok({
    action: 'save_settings',
    group: 'availability',
    data: { dailyLimit: 0, noticeDays: 0, blackoutDates: '2030-01-09' },
  });
  settingsChanged = true;
  assert.equal(
    (await times('2030-01-09')).length,
    0,
    'All blockouts includes business blackout dates',
  );
  await saveConfig({ ...config, blockouts: 'Staff time off only' });
  assert(
    (await times('2030-01-09')).length > 0,
    'Staff-only blockouts ignores business dates',
  );
  let fixture = await ok(
    {
      action: 'save_package',
      name: prefix + ' Package',
      service: initial.business.services[0],
      price: 10000,
      duration: '1 hour',
      description: 'Temporary scheduling regression package',
    },
    'crm',
  );
  packageId = fixture.packages.find((r) => r.name === prefix + ' Package').id;
  fixture = await ok(
    {
      action: 'save_event',
      title: prefix + ' Booking',
      client: 'QA',
      email: 'qa@example.com',
      date: '2030-01-07',
      time: '14:00',
      packageIds: [packageId],
      deposit: 0,
    },
    'crm',
  );
  eventId = fixture.events.find((r) => r.title === prefix + ' Booking').id;
  await ok({ action: 'advance_event', id: eventId, status: 'proposal' }, 'crm');
  await ok(
    { action: 'advance_event', id: eventId, status: 'confirmed' },
    'crm',
  );
  assert(
    !(await times()).includes('14:00'),
    'All bookings blocks unassigned confirmed events',
  );
  await saveConfig({ ...config, bookings: 'Assigned bookings only' });
  assert(
    (await times()).includes('14:00'),
    'Assigned-only ignores unassigned bookings',
  );
  await ok({ action: 'save_planning', eventId, staffIds: [staff.id] });
  assert(
    !(await times()).includes('14:00'),
    'Assigned-only blocks this host booking',
  );
  await saveConfig({ ...config, bookings: 'None' });
  assert((await times()).includes('14:00'), 'None ignores event bookings');
  await saveConfig({ ...config, enabled: false });
  assert(
    (
      await call(
        undefined,
        'appointments?' +
          new URLSearchParams({
            staff: staff.id,
            calendar: cal.id,
            date: '2030-01-07',
          }),
        false,
      )
    ).status >= 400,
  );
  await saveConfig({ ...config, enabled: true });
  await ok({
    action: 'save_appointment_calendar',
    staffId: staff.id,
    name: prefix + ' Second',
    config,
  });
  const calendars = (await read()).resources.filter(
    (r) => r.kind === 'appointment_calendars' && r.data.staffId === staff.id,
  );
  await ok({
    action: 'reorder_appointment_calendars',
    staffId: staff.id,
    ids: calendars.map((r) => r.id).reverse(),
  });
  const html = await (
    await fetch(base + '/schedule/' + staff.id + '?calendar=' + cal.id, {
      headers,
    })
  ).text();
  assert(html.includes('Schedule Appointment'));
  assert(
    !html.includes('Call the office'),
    'Private meeting details excluded from public page',
  );
  await ok({
    action: 'archive_appointment_calendar',
    staffId: staff.id,
    id: cal.id,
  });
  assert(
    (
      await call(
        undefined,
        'appointments?' +
          new URLSearchParams({
            staff: staff.id,
            calendar: cal.id,
            date: '2030-01-07',
          }),
        false,
      )
    ).status >= 400,
  );
  console.log(
    'PASS: owner authorization, calendar CRUD/order/pause, weekly persistence, partial time off, independent appointment hours, future limits, requests, atomic competing approvals, buffers, archive restore safety and public projection.',
  );
} finally {
  if (eventId)
    await ok(
      { action: 'event_lifecycle', ids: [eventId], lifecycle: 'Deleted' },
      'sales',
    );
  if (packageId)
    await ok(
      { action: 'delete_packages', ids: [packageId], confirm: 'DELETE' },
      'packages',
    );
  if (settingsChanged)
    await ok({
      action: 'save_settings',
      group: 'availability',
      data: initial.settings,
    });
  const j = await read();
  for (const r of j.sales.filter(
    (r) =>
      !r.archived &&
      (r.data.organizer === staff?.id || r.data.staffId === staff?.id),
  ))
    await ok(
      {
        action: 'archive_record',
        id: r.id,
        updatedAt: r.updated_at,
        archived: true,
      },
      'sales',
    );
  const own = (await read()).resources.filter((r) => r.name.startsWith(prefix));
  if (own.length)
    await ok({
      action: 'bulk_resources',
      ids: own.map((r) => r.id),
      operation: 'delete',
    });
}
