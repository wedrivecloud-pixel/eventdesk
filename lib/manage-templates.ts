import { details, appliesTo, type FormField } from './manage-config';
import { localToday } from './manage-pricing';
import type { Resource, Settings } from './settings';
import type { EventRecord } from './crm';
export function shiftDate(value: string, amount: number, unit: string) {
  const d = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime())) return '';
  if (unit === 'Months') {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + amount);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else d.setUTCDate(d.getUTCDate() + amount * (unit === 'Weeks' ? 7 : 1));
  return d.toISOString().slice(0, 10);
}
export function templatePatch(
  r: Resource,
  event: EventRecord,
  settings: Settings,
  sync = false,
  resources: Resource[] = [],
) {
  if (
    !appliesTo(
      r,
      event.items.map((p) => p.id),
    )
  )
    throw Error('This template does not apply to the event packages.');
  const ops = event.operations || {},
    d = details(r),
    lines = String(r.data.body || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  if (r.kind === 'contracts') return { contract: r.data.body };
  if (r.kind === 'checklists') {
    const category = resources.find(
      (c) =>
        c.kind === 'categories' &&
        c.id === r.data.categoryId &&
        c.data.ownerKind === 'checklists',
    );
    const booked =
      event.operations?.sales?.confirmedAt ||
      (event.status === 'confirmed' ? event.created_at : '');
    const basis =
      r.data.dateBasis === 'Payment due date'
        ? ops.quote?.dueDate
        : r.data.dateBasis === 'Book date'
          ? booked
            ? new Intl.DateTimeFormat('en-CA', {
                timeZone: String(settings.timezone || 'America/Los_Angeles'),
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(new Date(booked))
            : ''
          : event.date;
    const due =
      r.data.automaticDue !== false && basis
        ? shiftDate(
            basis || localToday(settings),
            Number(r.data.offset || 0) * (r.data.timing === 'After' ? 1 : -1),
            String(r.data.timeUnit || 'Days'),
          )
        : '';
    const old = ops.tasks || [],
      added = lines.map((label, index) => {
        const found = sync
          ? old.find((t) => t.templateId === r.id && t.templateIndex === index)
          : undefined;
        return {
          id: found?.id || crypto.randomUUID(),
          label,
          done: found?.done || false,
          notes: String(r.data.notes || ''),
          due,
          assignee: String(r.data.assignee || ''),
          templateId: r.id,
          templateIndex: index,
          categoryId: category?.id || String(r.data.categoryId || ''),
          categoryName: category?.name || '',
          showTodo: category?.data.showTodo !== false,
          staffView: category?.data.staffView !== false,
          staffEdit: category?.data.staffEdit !== false,
          clientView: category?.data.clientView === true,
        };
      });
    return {
      tasks: [...old.filter((t) => !sync || t.templateId !== r.id), ...added],
    };
  }
  if (r.kind === 'questionnaires') {
    if (sync && ops.questionsFinalized)
      throw Error('Reopen this questionnaire before synchronizing it.');
    const fields: FormField[] = d.fields.length
      ? d.fields
      : lines.map((label, i) => ({
          id: 'legacy-' + i,
          label,
          type: 'Text Box',
          hint: '',
          placeholder: '',
          required: false,
          options: [],
          tab: 'General',
          repeat: false,
          timeline: false,
          conditionField: '',
          conditionValue: '',
        }));
    const old = ops.questions || [],
      ids = Object.fromEntries(
        fields.map((f) => [
          f.id,
          (sync
            ? old.find((q) => q.templateId === r.id && q.sourceId === f.id)?.id
            : undefined) || crypto.randomUUID(),
        ]),
      );
    const added = fields.map((f) => {
      const found = sync
        ? old.find((q) => q.templateId === r.id && q.sourceId === f.id)
        : undefined;
      return {
        ...f,
        id: ids[f.id],
        sourceId: f.id,
        conditionField: ids[f.conditionField] || '',
        templateId: r.id,
        answer: found?.answer || '',
      };
    });
    return {
      questions: [
        ...old.filter((q) => !sync || q.templateId !== r.id),
        ...added,
      ],
    };
  }
  throw Error('Choose a checklist, questionnaire or contract template.');
}
