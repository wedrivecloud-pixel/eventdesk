import { validateStaffAssignment, staffConflictGuard } from '@/db/staffing';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { rawDb } from '@/db/raw';
import { voidRecordedPayment } from '@/db/payment-voids';
import { brandAction } from '@/db/brands';
import { designAction } from '@/db/design-collections';
import { staffSchedulingAction } from '@/db/appointment-scheduling';
import { businessFor, snapshot, operations, configuration } from '@/db/store';
import { modules, settingGroups, checkedFields } from '@/lib/settings';
import { text, cents, date, type EventRecord } from '@/lib/crm';
import { installmentSchedule } from '@/lib/payment-plans';
import { templatePatch } from '@/lib/manage-templates';
import { checkedAnswers } from '@/lib/manage-questions';
import { validateQuestionFiles } from '@/db/question-files';
import type { Resource } from '@/lib/settings';
import type { FormField } from '@/lib/manage-config';
import { validateResource, resourceAction } from '@/db/manage-resources';
import {
  systemTemplateAction,
  prepareMessageDrafts,
} from '@/db/message-templates';
import type { Data } from '@/lib/crm';
import {
  checklistAction,
  applyChecklistItems,
  upcomingChecklistBookings,
} from '@/db/checklists';
const response = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(req: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return response({ error: 'Sign in first.' }, 401);
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return response({ error: 'Invalid origin.' }, 403);
    const raw = await req.text();
    if (raw.length > 64000)
      return response({ error: 'Form is too large.' }, 413);
    const body = JSON.parse(raw);
    const business = await businessFor(user.userId);
    if (!business)
      return response({ error: 'Create your business first.' }, 400);
    const bid = business.id,
      db = rawDb(),
      now = new Date().toISOString();
    if (await brandAction(bid, body)) {
      // Brand identities and their package/media assignments belong to this owner.
    } else if (await staffSchedulingAction(bid, body)) {
      // Staff scheduling is scoped to this business.
    } else if (await designAction(bid, body)) {
      // Collection actions and booking choices are scoped to the owning business.
    } else if (await checklistAction(bid, body)) {
      // Checklist setup and booking updates are scoped to this owner’s business.
    } else if (body.action === 'prepare_message_drafts') {
      await prepareMessageDrafts(
        (await snapshot(user.userId)) as Data,
        body,
        new URL(req.url).origin,
      );
    } else if (await systemTemplateAction(bid, body)) {
      // Fixed system templates are customized only within this business.
    } else if (body.action === 'save_settings') {
      const group = settingGroups[body.group];
      if (!group) throw new Error('Unknown settings group.');
      const previous = (await configuration(bid)).settings;
      const data = checkedFields({ ...previous, ...body.data }, group.fields);
      if (data.depositMode === 'Percentage' && Number(data.depositValue) > 100)
        throw new Error('Percentage deposit cannot exceed 100%.');
      if (data.blackoutDates)
        for (const d of String(data.blackoutDates).split(/\s+/))
          date(d, 'Unavailable date');
      if (
        ['dueDays', 'validDays', 'dailyLimit', 'noticeDays'].some(
          (k) => data[k] !== undefined && !Number.isInteger(data[k]),
        )
      )
        throw new Error('Day and booking counts must be whole numbers.');
      await db
        .prepare(
          'INSERT INTO business_settings(business_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(business_id) DO UPDATE SET data=ed_patch(business_settings.data,excluded.data),updated_at=excluded.updated_at',
        )
        .bind(bid, JSON.stringify(data), now)
        .run();
    } else if (body.action === 'save_resource') {
      if (body.kind === 'system_templates')
        throw Error('Use the System Templates editor.');
      const resourceModule = modules[body.kind];
      if (!resourceModule) throw new Error('Unknown resource type.');
      const existing = body.id
        ? await db
            .prepare(
              'SELECT data FROM resources WHERE id=? AND business_id=? AND kind=?',
            )
            .bind(text(body.id, 'Record ID'), bid, body.kind)
            .first<{ data: string }>()
        : null;
      if (body.id && !existing)
        return response({ error: 'Record not found.' }, 404);
      const name = text(body.name, 'Name', 120),
        data = await validateResource(
          bid,
          body.kind,
          body.data,
          existing ? JSON.parse(existing.data) : undefined,
        );
      if (body.kind === 'discounts') {
        data.code = String(data.code).toUpperCase();
        const duplicate = await db
          .prepare(
            "SELECT id FROM resources WHERE business_id=? AND kind='discounts' AND archived=0 AND id!=? AND upper(ed_text(data,'$.code'))=?",
          )
          .bind(bid, body.id || '', data.code)
          .first();
        if (duplicate)
          throw Error(
            'This discount code is already in use. Choose a unique code.',
          );
        if (data.mode === 'Percentage' && Number(data.amount) > 100)
          throw new Error('A percentage discount cannot exceed 100%.');
      }
      if (data.starts && data.ends && String(data.starts) > String(data.ends))
        throw new Error('End date must be after start date.');
      const resourceId = body.id || crypto.randomUUID();
      if (body.id) {
        const r = await db
          .prepare(
            'UPDATE resources SET name=?,data=?,updated_at=? WHERE id=? AND business_id=? AND kind=?',
          )
          .bind(
            name,
            JSON.stringify(data),
            now,
            text(body.id, 'Record ID'),
            bid,
            body.kind,
          )
          .run();
        if (!r.meta.changes)
          return response({ error: 'Record not found.' }, 404);
      } else
        await db
          .prepare(
            'INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
          )
          .bind(
            resourceId,
            bid,
            body.kind,
            name,
            JSON.stringify(data),
            now,
            now,
          )
          .run();
      if (body.kind === 'checklists' && body.syncExisting === true)
        await applyChecklistItems(
          bid,
          [{ id: resourceId, kind: 'checklists', name, data, archived: 0 }],
          await upcomingChecklistBookings(bid),
        );
    } else if (await resourceAction(bid, body)) {
      // Atomic bulk and hierarchy actions return the refreshed workspace below.
    } else if (body.action === 'apply_templates') {
      if (
        !Array.isArray(body.eventIds) ||
        !body.eventIds.length ||
        body.eventIds.length > 50
      )
        throw Error('Select between 1 and 50 events.');
      const c = await configuration(bid),
        r = c.resources.find((r) => r.id === body.templateId && !r.archived);
      if (!r) throw Error('Template unavailable.');
      const writes = [];
      for (const id of new Set(body.eventIds)) {
        const event = await db
          .prepare('SELECT * FROM events WHERE id=? AND business_id=?')
          .bind(text(id, 'Event'), bid)
          .first<Record<string, unknown>>();
        if (!event) throw Error('Event unavailable.');
        const ops = await operations(id, bid),
          patch = templatePatch(
            { ...r },
            {
              ...event,
              items: JSON.parse(String(event.items)),
              operations: ops,
            } as EventRecord,
            c.settings,
            body.sync === true,
            c.resources,
          );
        if ((patch.tasks || patch.questions || []).length > 200)
          throw Error('An event has reached its planning-item limit.');
        writes.push(
          db
            .prepare(
              'INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_patch(event_operations.data,excluded.data) WHERE event_operations.business_id=?',
            )
            .bind(id, bid, JSON.stringify(patch), bid),
        );
      }
      await db.batch(writes);
    } else if (body.action === 'archive_resource') {
      const system = await db
        .prepare(
          "SELECT id FROM resources WHERE id=? AND business_id=? AND kind='system_templates'",
        )
        .bind(text(body.id, 'Record ID'), bid)
        .first();
      if (system) throw Error('System templates cannot be archived.');
      if (typeof body.archived !== 'boolean')
        throw new Error('Invalid archive choice.');
      const r = await db
        .prepare(
          'UPDATE resources SET archived=?,updated_at=? WHERE id=? AND business_id=?',
        )
        .bind(body.archived ? 1 : 0, now, text(body.id, 'Record ID'), bid)
        .run();
      if (!r.meta.changes) return response({ error: 'Record not found.' }, 404);
    } else {
      const id = text(body.eventId, 'Event ID');
      const event = await db
        .prepare('SELECT * FROM events WHERE id=? AND business_id=?')
        .bind(id, bid)
        .first<Record<string, unknown>>();
      if (!event) return response({ error: 'Event not found.' }, 404);
      if (body.action === 'void_payment') {
        const result = await voidRecordedPayment(bid, id, body.paymentId, body.reason, user);
        if (result === 'not_found') return response({ error: 'Payment not found.' }, 404);
        if (result === 'already_voided')
          return response({ error: 'This payment has already been voided. Refresh to see the updated history.' }, 409);
        return response(await snapshot(user.userId));
      }
      const ops = await operations(id, bid);
      let patch: Record<string, unknown> = {};
      if (body.action === 'apply_template') {
        const template = await db
          .prepare(
            'SELECT * FROM resources WHERE id=? AND business_id=? AND archived=0',
          )
          .bind(text(body.templateId, 'Template ID'), bid)
          .first<Record<string, unknown>>();
        if (!template) throw new Error('Template unavailable.');
        const config = await configuration(bid);
        patch = templatePatch(
          { ...template, data: JSON.parse(String(template.data)) } as Resource,
          {
            ...event,
            items: JSON.parse(String(event.items)),
            operations: ops,
          } as EventRecord,
          config.settings,
          body.sync === true,
          config.resources,
        );
        if (
          ((patch.tasks as unknown[]) || (patch.questions as unknown[]) || [])
            .length > 200
        )
          throw new Error('This event has reached its planning-item limit.');
      } else if (body.action === 'save_planning') {
        if (body.taskId) {
          if (typeof body.done !== 'boolean')
            throw new Error('Invalid task status.');
          if (!ops.tasks?.some((x: { id: string }) => x.id === body.taskId))
            throw new Error('Task not found.');
          patch.tasks = ops.tasks.map((x: { id: string }) =>
            x.id === body.taskId ? { ...x, done: body.done } : x,
          );
        }
        if (body.finalized !== undefined) {
          if (typeof body.finalized !== 'boolean')
            throw Error('Invalid finalization choice.');
          patch.questionsFinalized = body.finalized;
        }
        if (body.answers || body.finalized === true) {
          if (ops.questionsFinalized && body.finalized !== false)
            throw Error('Reopen the questionnaire before changing answers.');
          const fields = (ops.questions || []).map(
            (q: Partial<FormField>) =>
              ({ type: 'Text Box', options: [], ...q }) as FormField,
          );
          const values = checkedAnswers(
            body.answers ||
              Object.fromEntries(
                (ops.questions || []).map(
                  (q: { id: string; answer: string }) => [q.id, q.answer],
                ),
              ),
            fields,
            body.finalized === true,
          );
          await validateQuestionFiles(
            String(bid),
            'event:' + id,
            values,
            fields,
          );
          patch.questions = (ops.questions || []).map((q: { id: string }) => ({
            ...q,
            answer: values[q.id],
          }));
        }
        if (body.staffIds) {
          if (!Array.isArray(body.staffIds) || body.staffIds.length > 30)
            throw new Error('Choose up to 30 staff.');
          for (const id of body.staffIds) {
            if (
              !(await db
                .prepare(
                  'SELECT id FROM resources WHERE id=? AND business_id=? AND kind=? AND archived=0',
                )
                .bind(text(id, 'Staff ID'), bid, 'staff')
                .first())
            )
              throw new Error('Staff unavailable.');
          }
          if (event.status === 'confirmed' && event.lifecycle === 'Active')
            await validateStaffAssignment(
              bid,
              id,
              {
                date: String(event.date),
                time: String(event.time),
                items: JSON.parse(String(event.items)),
              },
              body.staffIds,
            );
          patch.staffIds = [...new Set(body.staffIds)];
        }
        if (body.designId !== undefined) {
          if (
            body.designId &&
            !(await db
              .prepare(
                'SELECT id FROM resources WHERE id=? AND business_id=? AND kind=? AND archived=0',
              )
              .bind(body.designId, bid, 'designs')
              .first())
          )
            throw new Error('Design unavailable.');
          patch.designId = body.designId || '';
        }
      } else if (body.action === 'apply_payment_plan') {
        const c = await configuration(bid),
          plan = c.resources.find(
            (r) =>
              r.id === body.planId &&
              r.kind === 'payment_plans' &&
              !r.archived &&
              r.data.enabled !== false,
          );
        if (!plan) throw Error('Payment plan unavailable.');
        patch.paymentPlan = {
          id: plan.id,
          name: plan.name,
          schedule: installmentSchedule(
            Number(event.total),
            Number(event.deposit),
            String(plan.data.planType),
            Number(plan.data.splitCount || 1),
            String(event.created_at).slice(0, 10),
            ops.quote?.dueDate || String(event.date),
          ),
        };
      } else if (body.action === 'record_payment') {
        const amount = cents(body.amount, 'Payment'),
          tip = cents(body.tip ?? 0, 'Tip');
        if (amount + tip <= 0)
          throw new Error('Payment must be greater than zero.');
        const method = text(body.method, 'Method', 120);
        const custom = (await configuration(bid)).resources
          .filter(
            (r) =>
              r.kind === 'payment_methods' &&
              !r.archived &&
              r.data.enabled !== false,
          )
          .map((r) => r.name);
        if (
          ![
            'Cash',
            'Check',
            'Bank transfer',
            'External card payment',
            'Other',
            ...custom,
          ].includes(method)
        )
          throw new Error('Unknown payment method.');
        const r = await db
          .prepare(
            "INSERT INTO payments(id,business_id,event_id,amount,method,date,reference,created_at,tip) SELECT ?,?,?,?,?,?,?,?,? WHERE ? <= (SELECT total FROM events WHERE id=? AND business_id=?)-(SELECT COALESCE(SUM(amount),0) FROM payments WHERE event_id=? AND business_id=? AND voided_at='')",
          )
          .bind(
            crypto.randomUUID(),
            bid,
            id,
            amount,
            method,
            date(body.date, 'Payment date'),
            text(body.reference ?? '', 'Reference', 200, false),
            now,
            tip,
            amount,
            id,
            bid,
            id,
            bid,
          )
          .run();
        if (!r.meta.changes)
          throw new Error('Payment exceeds the remaining balance.');
      } else throw new Error('Unknown action.');
      if (
        patch.staffIds &&
        event.status === 'confirmed' &&
        event.lifecycle === 'Active'
      ) {
        const guard = staffConflictGuard(
          bid,
          id,
          {
            date: String(event.date),
            time: String(event.time),
            items: JSON.parse(String(event.items)),
          },
          patch.staffIds as string[],
        );
        const changed = await db
          .prepare(
            `INSERT INTO event_operations(event_id,business_id,data) SELECT ?,?,? WHERE NOT ${guard.sql} ON CONFLICT(event_id) DO UPDATE SET data=ed_patch(event_operations.data,excluded.data) WHERE event_operations.business_id=? AND NOT ${guard.sql}`,
          )
          .bind(
            id,
            bid,
            JSON.stringify(patch),
            ...guard.args,
            bid,
            ...guard.args,
          )
          .run();
        if (!changed.meta.changes)
          throw Error(
            'Staff availability changed. Refresh and choose available staff.',
          );
      } else if (Object.keys(patch).length)
        await db
          .prepare(
            'INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_patch(event_operations.data,excluded.data) WHERE event_operations.business_id=?',
          )
          .bind(id, bid, JSON.stringify(patch), bid)
          .run();
    }
    return response(await snapshot(user.userId));
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to save.';
    if (m.includes('D1_') || m.includes('SQLITE')) {
      console.error('Management database operation failed');
      return response(
        { error: 'Unable to save right now. Please try again.' },
        503,
      );
    }
    return response({ error: m }, 400);
  }
}
