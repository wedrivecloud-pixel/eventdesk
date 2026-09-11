import { details, appliesTo, ordered, type FormField } from './manage-config';
import type { Resource } from './settings';
export const contentTypes = [
  'Header',
  'Subheader',
  'Separator',
  'Plain Text',
  'Rich Text',
  'Static Image',
];
export function bookingQuestions(
  resources: Resource[],
  packageIds: string[],
  internal=false,
): FormField[] {
  return ordered(
    resources.filter(
      (r) =>
        (r.kind === 'booking_questions' ||
          (r.kind === 'extra_categories' &&
            (internal || r.data.visibility === 'Always show'))) &&
        !r.archived &&
        (internal || r.data.collect !== 'Internal only') &&
        appliesTo(r, packageIds),
    ),
  ).map((r) => ({
    id: r.id,
    label: String(r.data.label || r.name),
    type: String(
      r.data.inputType ||
        (r.kind === 'extra_categories' ? 'Dropdown' : 'Text Field'),
    ),
    hint: String(r.data.hint || ''),
    placeholder: '',
    required: Boolean(r.data.required),
    options: String(r.data.options || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    tab: 'General',
    repeat: false,
    timeline: false,
    conditionField: '',
    conditionValue: '',
  }));
}
export function visibleQuestion(
  q: FormField,
  fields: FormField[],
  answers: Record<string, string>,
  visited: string[] = [],
): boolean {
  if (!q.conditionField) return true;
  if (visited.includes(q.id)) return false;
  const parent = fields.find((f) => f.id === q.conditionField);
  return (
    !!parent &&
    visibleQuestion(parent, fields, answers, [...visited, q.id]) &&
    (answers[parent.id] || '') === q.conditionValue
  );
}
export function checkedAnswers(
  input: unknown,
  fields: FormField[],
  requireAll = true,
): Record<string, string> {
  if (
    input !== undefined &&
    (!input || typeof input !== 'object' || Array.isArray(input))
  )
    throw Error('Invalid question answers.');
  const raw = (input || {}) as Record<string, unknown>,
    answers: Record<string, string> = {};
  for (const q of fields) {
    const v = raw[q.id] ?? '';
    if (typeof v !== 'string' || v.length > 4000)
      throw Error(`${q.label}: answer must be at most 4,000 characters.`);
    answers[q.id] = v.trim();
  }
  for (const q of fields) {
    if (!visibleQuestion(q, fields, answers) || contentTypes.includes(q.type)) {
      answers[q.id] = '';
      continue;
    }
    const v = answers[q.id];
    if (requireAll && q.required && !v)
      throw Error(`Please answer: ${q.label}.`);
    if (!v) continue;
    if (
      ['Dropdown', 'Radio Buttons'].includes(q.type) &&
      !q.options.includes(v)
    )
      throw Error(`Choose a listed option for ${q.label}.`);
    if (
      q.type === 'Checkbox Group' &&
      v.split('\n').some((s) => !q.options.includes(s))
    )
      throw Error(`Choose listed options for ${q.label}.`);
    if (q.type === 'Checkbox' && v !== 'Yes')
      throw Error(`Invalid answer for ${q.label}.`);
    if (
      q.type === 'Date Field' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        !Number.isFinite(Date.parse(v + 'T12:00:00Z')) ||
        new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) !== v)
    )
      throw Error(`Enter a valid date for ${q.label}.`);
    if (q.type === 'Time Field' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
      throw Error(`Enter a valid time for ${q.label}.`);
  }
  return answers;
}
