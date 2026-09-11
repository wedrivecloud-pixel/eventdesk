import assert from 'node:assert/strict';
import {
  questionnaireSamples,
  questionnaireFromSample,
} from './questionnaires-unit.mjs';
const base = 'http://localhost:3000';
const headers = {
  Cookie: '__sites_local_auth=1',
  'Content-Type': 'application/json',
};
const tag = 'Questionnaire QA ' + Date.now();
async function call(body, path = 'manage', auth = true) {
  const response = await fetch(`${base}/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
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
  'Only run in local Sample Event Studio',
);
const resources = [];
let packageId, eventId;
try {
  assert.equal(
    (
      await call(
        {
          action: 'save_resource',
          ...questionnaireFromSample(questionnaireSamples[0]),
        },
        'manage',
        false,
      )
    ).status,
    401,
  );
  for (const sample of questionnaireSamples) {
    const input = questionnaireFromSample(sample);
    input.name = tag + ' ' + sample.id;
    const j = await ok({ ...input, action: 'save_resource' });
    const saved = j.resources.find((r) => r.name === input.name);
    resources.push(saved.id);
    assert.deepEqual(
      JSON.parse(saved.data.details),
      JSON.parse(input.data.details),
    );
    assert.equal(saved.data.clientView, !sample.staffOnly);
    assert.equal(saved.data.clientEdit, !sample.staffOnly);
  }
  const fresh = await ok(undefined, 'crm');
  assert.equal(
    fresh.resources.filter((r) => r.name.startsWith(tag)).length,
    questionnaireSamples.length,
  );
  const pd = await ok(
    {
      action: 'save_package',
      name: tag + ' Package',
      service: initial.business.services[0],
      price: 10000,
      duration: '1 hour',
      description: 'Local temporary test',
    },
    'crm',
  );
  packageId = pd.packages.find((p) => p.name === tag + ' Package').id;
  const ed = await ok(
    {
      action: 'save_event',
      title: tag + ' Event',
      client: 'Questionnaire Test Client',
      email: 'questionnaire-test@example.com',
      phone: '+15550001111',
      date: '2045-08-22',
      time: '12:00',
      packageIds: [packageId],
      deposit: 0,
    },
    'crm',
  );
  eventId = ed.events.find((e) => e.title === tag + ' Event').id;
  const template = fresh.resources.find((r) => r.id === resources[0]);
  const d = JSON.parse(template.data.details);
  d.fields[0].label = 'Customized guest count';
  d.packageMode = 'selected';
  d.packageIds = [packageId];
  await ok({
    action: 'save_resource',
    id: template.id,
    kind: 'questionnaires',
    name: template.name + ' edited',
    data: { ...template.data, details: JSON.stringify(d) },
  });
  const applied = await ok({
    action: 'apply_templates',
    templateId: template.id,
    eventIds: [eventId],
    sync: false,
  });
  const question = applied.events.find((e) => e.id === eventId).operations
    .questions[0];
  assert.equal(question.label, 'Customized guest count');
  await ok({
    action: 'save_planning',
    eventId,
    answers: { [question.id]: '150' },
    finalized: true,
  });
  assert.ok(
    (
      await call({
        action: 'apply_templates',
        templateId: template.id,
        eventIds: [eventId],
        sync: true,
      })
    ).status >= 400,
  );
  await ok({ action: 'save_planning', eventId, finalized: false });
  const synced = await ok({
    action: 'apply_templates',
    templateId: template.id,
    eventIds: [eventId],
    sync: true,
  });
  assert.equal(
    synced.events.find((e) => e.id === eventId).operations.questions[0].answer,
    '150',
  );
  assert.equal(
    (
      await call({
        action: 'save_resource',
        id: crypto.randomUUID(),
        kind: 'questionnaires',
        name: 'Unavailable',
        data: template.data,
      })
    ).status,
    404,
  );
  console.log(
    'PASS: all samples save and reload; customization, package scope, application, answers, finalization lock, synchronization, and owner authorization.',
  );
} finally {
  for (const id of resources.reverse())
    await ok({ action: 'delete_resource', id });
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
}
