import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const out = resolve('work/questionnaires-unit');
await mkdir(out, { recursive: true });
for (const name of [
  'settings',
  'manage-config',
  'manage-pricing',
  'manage-questions',
  'manage-templates',
  'questionnaire-samples',
]) {
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
}
export const { questionnaireSamples, questionnaireFromSample } = await import(
  pathToFileURL(`${out}/questionnaire-samples.mjs`)
);
const { details, fieldTypes } = await import(
  pathToFileURL(`${out}/manage-config.mjs`)
);
const { checkedAnswers, visibleQuestion } = await import(
  pathToFileURL(`${out}/manage-questions.mjs`)
);
const { templatePatch } = await import(
  pathToFileURL(`${out}/manage-templates.mjs`)
);
assert.equal(questionnaireSamples.length, 11);
assert.equal(
  new Set(questionnaireSamples.map((s) => s.id)).size,
  questionnaireSamples.length,
);
for (const sample of questionnaireSamples) {
  const a = questionnaireFromSample(sample),
    b = questionnaireFromSample(sample);
  const ad = details(a),
    bd = details(b);
  assert.ok(ad.fields.length > 0 && ad.fields.length <= 100);
  assert.equal(new Set(ad.fields.map((f) => f.id)).size, ad.fields.length);
  assert.ok(
    ad.fields.every(
      (f) => fieldTypes.includes(f.type) && ad.tabs.includes(f.tab),
    ),
  );
  assert.ok(ad.fields.every((f) => !bd.fields.some((g) => g.id === f.id)));
  assert.ok(
    ad.fields.every(
      (f) =>
        !f.conditionField || ad.fields.some((g) => g.id === f.conditionField),
    ),
  );
  const event = {
    items: [{ id: 'package' }],
    operations: {},
    date: '2045-08-22',
  };
  a.id = 'template';
  const applied = templatePatch(a, event, {}, false);
  assert.equal(applied.questions.length, ad.fields.length);
  assert.ok(
    applied.questions.every(
      (q) =>
        !q.conditionField ||
        applied.questions.some((g) => g.id === q.conditionField),
    ),
  );
  applied.questions[0].answer = 'Preserved answer';
  const synced = templatePatch(a, { ...event, operations: applied }, {}, true);
  assert.equal(synced.questions[0].answer, 'Preserved answer');
  assert.equal(synced.questions[0].id, applied.questions[0].id);
  assert.throws(
    () =>
      templatePatch(
        a,
        { ...event, operations: { ...applied, questionsFinalized: true } },
        {},
        true,
      ),
    /Reopen/,
  );
  ad.fields[0].label = 'Edited only in this copy';
  assert.notEqual(sample.fields[0].label, ad.fields[0].label);
}
const planning = questionnaireFromSample(
  questionnaireSamples.find((s) => s.id === 'planning-questionnaire'),
);
const planningFields = details(planning).fields;
assert.equal(planningFields.length, 6);
assert.deepEqual(
  planningFields.map((f) => f.type),
  [
    'Text Box',
    'Radio Buttons',
    'Double Text Field',
    'Text Field',
    'Double Text Field',
    'Text Box',
  ],
);
assert.deepEqual(planningFields[1].options, ['Yes', 'No', 'Not sure']);
assert.match(planningFields[1].label, /25 feet/);
assert.equal(planningFields[2].placeholder, 'Booth opens | Booth closes');
assert.equal(planningFields[4].placeholder, 'Name | Mobile number');
assert.equal(planning.data.showWhen, 'Always');
assert.equal(planning.data.clientView, true);
assert.equal(planning.data.clientEdit, true);
assert.equal(planning.data.staffView, true);
assert.equal(planning.data.staffEdit, true);
assert.equal(details(planning).packageMode, 'all');
checkedAnswers(
  Object.fromEntries(
    planningFields.map((f, i) => [
      f.id,
      [
        'Beside the stage, ground-floor access',
        'Not sure',
        '5:00 PM\n9:00 PM',
        'Rivera Celebration',
        'Jamie\n555-0100',
        'Outdoor setup under cover',
      ][i],
    ]),
  ),
  planningFields,
  true,
);
const staff = questionnaireFromSample(
  questionnaireSamples.find((s) => s.id === 'staff-notes'),
);
assert.equal(staff.data.clientView, false);
assert.equal(staff.data.clientEdit, false);
assert.equal(staff.data.showWhen, 'After event');
const fields = details(staff).fields;
const answers = Object.fromEntries(
  fields
    .filter((f) => f.required && !f.conditionField)
    .map((f) => [f.id, f.options[0]]),
);
for (const f of fields.filter((f) => f.conditionField)) {
  answers[f.conditionField] = f.conditionValue === 'Yes' ? 'No' : 'Yes';
  assert.equal(visibleQuestion(f, fields, answers), false);
}
checkedAnswers(answers, fields, true);
const followup = fields.find((f) => f.conditionField);
answers[followup.conditionField] = followup.conditionValue;
assert.equal(visibleQuestion(followup, fields, answers), true);
assert.throws(() => checkedAnswers(answers, fields, true), /details/);
answers[followup.id] = 'Traffic delay; notified coordinator.';
checkedAnswers(answers, fields, true);
assert.ok(
  questionnaireSamples
    .find((s) => s.id === 'timeline')
    .fields.every((f) => f.type === 'Time Field'),
);
for (const id of ['wedding-suggestions', 'timeline-suggestions']) {
  assert.ok(
    questionnaireSamples
      .find((s) => s.id === id)
      .fields.some((f) => f.type === 'Song' && f.options.length),
  );
}
console.log(
  'PASS: 11 sample definitions including Planning Questionnaire, independent copies, remapped conditions, required follow-ups, permissions, compound answers, suggestions, timeline fields, application and synchronization.',
);
