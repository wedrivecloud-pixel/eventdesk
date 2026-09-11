import type { Data, EventRecord } from './crm';
import { activeEvent, balance, coverage, dateAdd } from './sales';
import { businessDay, overdueBalance, revenueSnapshot } from './overview';
import { contentTypes, visibleQuestion } from './manage-questions';
import type { FormField } from './manage-config';

export const proposalExpiry = (e: EventRecord) =>
  e.operations?.sales?.expires || e.operations?.quote?.validUntil || '';
export const pendingRequest = (e: EventRecord) =>
  activeEvent(e) &&
  e.status !== 'confirmed' &&
  !!e.operations?.sales?.review &&
  (e.operations?.sales?.origin === 'Online booking' ||
    e.source === 'Online booking request');
export type ReadinessItem = {
  key: string;
  label: string;
  detail: string;
  state: 'done' | 'needed' | 'unset';
  tab: string;
};
export function eventReadiness(
  e: EventRecord,
  data: Data,
  today: string,
): ReadinessItem[] {
  const paid = (data.payments || [])
    .filter((p) => p.event_id === e.id)
    .reduce((n, p) => n + p.amount, 0);
  const due = overdueBalance(e, paid, today),
    deposit = Math.max(0, Math.min(e.deposit, e.total) - paid),
    staff = coverage(e, data);
  const fields = (e.operations?.questions || []).map((q) => ({
    ...q,
    type: q.type || 'Text Field',
    options: q.options || [],
    conditionField: q.conditionField || '',
    conditionValue: q.conditionValue || '',
  })) as FormField[];
  const answers = Object.fromEntries(
    (e.operations?.questions || []).map((q) => [q.id, q.answer]),
  );
  const visible = fields.filter(
    (q) =>
      !contentTypes.includes(q.type) && visibleQuestion(q, fields, answers),
  );
  const missing = visible.filter(
    (q) => q.required && !answers[q.id]?.trim(),
  ).length;
  const answered = visible.filter((q) => answers[q.id]?.trim()).length;
  const finalized = !!e.operations?.questionsFinalized && !missing;
  // Tasks explicitly due after the event are post-event work, not readiness blockers.
  const allTasks = e.operations?.tasks || [],
    tasks = allTasks.filter((t) => !t.due || t.due <= e.date),
    unfinished = tasks.filter((t) => !t.done).length;
  return [
    {
      key: 'payment',
      label: 'Payment',
      state: due || deposit ? 'needed' : 'done',
      detail: due
        ? 'Past-due balance'
        : deposit
          ? 'Deposit needed'
          : balance(e, data)
            ? e.deposit
              ? 'Deposit covered · balance later'
              : 'No deposit required · balance later'
            : 'Paid in full',
      tab: 'payments',
    },
    {
      key: 'staff',
      label: 'Staff',
      state: staff.missing
        ? 'needed'
        : staff.required || staff.assigned.length
          ? 'done'
          : 'unset',
      detail: staff.missing
        ? `${staff.missing} more needed`
        : staff.assigned.length
          ? `${staff.assigned.length} assigned`
          : 'No requirement set',
      tab: 'team',
    },
    {
      key: 'questions',
      label: 'Questionnaire',
      state: !visible.length ? 'unset' : finalized ? 'done' : 'needed',
      detail: !visible.length
        ? 'Not assigned'
        : finalized
          ? 'Finalized'
          : missing
            ? `${missing} required answer${missing === 1 ? '' : 's'} missing`
            : `${answered}/${visible.length} answered · review needed`,
      tab: 'planning',
    },
    {
      key: 'checklist',
      label: 'Checklist',
      state: !tasks.length
        ? allTasks.length
          ? 'done'
          : 'unset'
        : unfinished
          ? 'needed'
          : 'done',
      detail: !tasks.length
        ? allTasks.length
          ? 'Only post-event tasks'
          : 'Not assigned'
        : `${tasks.length - unfinished}/${tasks.length} complete`,
      tab: 'planning',
    },
  ];
}
export type AttentionItem = {
  id: string;
  event: EventRecord;
  category: string;
  label: string;
  detail: string;
  tab: string;
  urgency: number;
  due: string;
};
function firstUnpaidDueDate(e: EventRecord, paid: number, today: string) {
  let cumulative = 0;
  for (const installment of [
    ...(e.operations?.paymentPlan?.schedule || []),
  ].sort((a, b) => a.date.localeCompare(b.date))) {
    cumulative += installment.amount;
    if (installment.date < today && cumulative > paid) return installment.date;
  }
  return e.operations?.quote?.dueDate || e.date;
}
export function overviewPriorities(data: Data, today: string) {
  const items: AttentionItem[] = [],
    cutoff = dateAdd(today, 29);
  const add = (
    e: EventRecord,
    category: string,
    label: string,
    detail: string,
    tab: string,
    urgency: number,
    due = e.date,
  ) =>
    items.push({
      id: e.id + ':' + category,
      event: e,
      category,
      label,
      detail,
      tab,
      urgency,
      due,
    });
  for (const e of data.events.filter(activeEvent)) {
    if (pendingRequest(e))
      add(
        e,
        'approval',
        'Booking request',
        'Review before confirming this date',
        'planning',
        1,
        businessDay(
          e.created_at,
          String(data.settings?.timezone || 'America/Los_Angeles'),
        ),
      );
    if (e.status === 'proposal') {
      const expires = proposalExpiry(e);
      if (expires && expires <= dateAdd(today, 7))
        add(
          e,
          'proposal',
          expires < today ? 'Proposal expired' : 'Proposal expiring',
          'Review the proposal and follow-up date',
          'planning',
          expires < today ? 2 : 3,
          expires,
        );
    }
    if (e.status !== 'confirmed' && !pendingRequest(e)) {
      if (e.follow_up && e.follow_up <= today)
        add(
          e,
          'followup',
          'Follow-up due',
          'Open this record to review the next step',
          'planning',
          2,
          e.follow_up,
        );
      else if (e.status === 'lead' && !e.follow_up)
        add(
          e,
          'followup',
          'Set a follow-up',
          'This inquiry has no next contact date',
          'planning',
          4,
          businessDay(
            e.created_at,
            String(data.settings?.timezone || 'America/Los_Angeles'),
          ),
        );
    }
    if (e.status !== 'confirmed') continue;
    const paid = (data.payments || [])
        .filter((p) => p.event_id === e.id)
        .reduce((n, p) => n + p.amount, 0),
      due = overdueBalance(e, paid, today);
    if (due)
      add(
        e,
        'payment',
        'Payment past due',
        'Review the balance and payment schedule',
        'payments',
        0,
        firstUnpaidDueDate(e, paid, today),
      );
    else if (paid < Math.min(e.deposit, e.total))
      add(
        e,
        'payment',
        'Deposit needed',
        'The requested deposit is not fully covered',
        'payments',
        2,
      );
    if (e.date < today || e.date > cutoff) continue;
    for (const r of eventReadiness(e, data, today).filter(
      (r) => r.state === 'needed' && r.key !== 'payment',
    ))
      add(e, r.key, r.label + ' needs attention', r.detail, r.tab, 3);
  }
  return items.sort(
    (a, b) =>
      a.urgency - b.urgency ||
      a.due.localeCompare(b.due) ||
      a.id.localeCompare(b.id),
  );
}
export function overviewSummary(data: Data, today: string) {
  const revenue = revenueSnapshot(
    data,
    { basis: 'Payment', range: 'This month', group: 'Month', from: '', to: '' },
    today,
  );
  const confirmed = data.events.filter(
    (e) =>
      e.status === 'confirmed' &&
      (activeEvent(e) || e.lifecycle === 'Postponed'),
  );
  return {
    collected: revenue.total.paid,
    outstanding: confirmed.reduce((n, e) => n + balance(e, data), 0),
    upcoming: confirmed.filter(
      (e) => activeEvent(e) && e.date >= today && e.date <= dateAdd(today, 29),
    ).length,
    requests: data.events.filter(pendingRequest).length,
  };
}
