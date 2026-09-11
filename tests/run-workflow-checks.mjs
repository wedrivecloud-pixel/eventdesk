// Local sample database only. Isolate pricing and capacity from earlier test runs.
import assert from 'node:assert/strict';
async function api(path, body) {
  const r = await fetch('http://localhost:3000/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Cookie: '__sites_local_auth=1',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  return d;
}
const initial = await api('crm'),
  activeFlex = initial.resources.filter(
    (r) => r.kind === 'flex' && !r.archived,
  );
async function settings(group, data) {
  await api('manage', { action: 'save_settings', group, data });
}
try {
  for (const r of activeFlex)
    await api('manage', {
      action: 'archive_resource',
      id: r.id,
      archived: true,
    });
  await settings('pricing', { taxRate: 0, travelBase: 0, mileRate: 0 });
  await settings('availability', {
    dailyLimit: 0,
    noticeDays: 0,
    blackoutDates: '',
  });
  await import('./workflow.mjs');
  await import('./management.mjs');
} finally {
  for (const group of ['pricing', 'availability', 'payments'])
    await settings(group, initial.settings);
  for (const r of activeFlex)
    await api('manage', {
      action: 'archive_resource',
      id: r.id,
      archived: false,
    });
  await api('crm', { action: 'save_business', ...initial.business });
}
