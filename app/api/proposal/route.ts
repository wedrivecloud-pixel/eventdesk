import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor, operations, snapshot } from '@/db/store';
import { rawDb } from '@/db/raw';
import { text } from '@/lib/crm';
import { checkedInvoice } from '@/lib/proposal';
import { addBookingDesigns } from '@/db/design-collections';
import { date } from '@/lib/crm';
const json = (v: unknown, status = 200) =>
  Response.json(v, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function POST(req: Request) {
  try {
    const user = await getChatGPTUser(),
      b = user && (await businessFor(user.userId));
    if (!b) return json({ error: 'Sign in to your business workspace.' }, 401);
    if (
      req.headers.get('sec-fetch-site') === 'cross-site' ||
      (req.headers.get('origin') &&
        req.headers.get('origin') !== new URL(req.url).origin)
    )
      return json({ error: 'Invalid origin.' }, 403);
    const raw = await req.text();
    if (raw.length > 64000)
      return json({ error: 'Request is too large.' }, 413);
    const body = JSON.parse(raw),
      id = text(body.eventId, 'Event', 100),
      db = rawDb();
    const e = await db
      .prepare(
        "SELECT id,lifecycle FROM events WHERE id=? AND business_id=? AND status IN ('proposal','confirmed')",
      )
      .bind(id, b.id)
      .first<{ id: string; lifecycle: string }>();
    if (!e) return json({ error: 'Proposal unavailable.' }, 404);
    if (body.action === 'revoke_link') {
      await db
        .prepare(
          "UPDATE sales_records SET archived=1,updated_at=? WHERE id=? AND business_id=? AND kind='proposal_link'",
        )
        .bind(new Date().toISOString(), 'proposal-link:' + id, b.id)
        .run();
      return json({ revoked: true });
    }
    if (e.lifecycle !== 'Active')
      return json(
        {
          error:
            'Restore this record before changing it or creating a client link.',
        },
        409,
      );
    if (body.action === 'add_designs') {
      await addBookingDesigns(b.id, id);
      return json(await snapshot(user!.userId));
    }
    if (
      body.action === 'add_checklist_task' ||
      body.action === 'reset_checklist'
    ) {
      const ops = await operations(id, b.id),
        tasks = ops.tasks || [];
      if (JSON.stringify(tasks) !== JSON.stringify(body.previous || []))
        return json(
          { error: 'Checklist changed. Reopen this proposal and try again.' },
          409,
        );
      const next =
        body.action === 'reset_checklist'
          ? tasks.map((t: Record<string, unknown>) => ({ ...t, done: false }))
          : [
              ...tasks,
              {
                id: crypto.randomUUID(),
                label: text(body.label, 'Task', 200),
                due: date(body.due ?? '', 'Due date', false),
                done: false,
                categoryName: 'Event checklist',
                showTodo: true,
                staffView: true,
                staffEdit: true,
                clientView: false,
              },
            ];
      if (next.length > 200)
        throw Error('Each event supports up to 200 checklist tasks.');
      const changed = await db
        .prepare(
          "INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_set(event_operations.data,'$.tasks',ed_json(?)) WHERE event_operations.business_id=? AND ed_json(COALESCE(ed_text(event_operations.data,'$.tasks'),'[]'))=ed_json(?)",
        )
        .bind(
          id,
          b.id,
          JSON.stringify({ tasks: next }),
          JSON.stringify(next),
          b.id,
          JSON.stringify(tasks),
        )
        .run();
      if (!changed.meta.changes)
        return json(
          { error: 'Checklist changed. Reopen this proposal and try again.' },
          409,
        );
      return json(await snapshot(user!.userId));
    }
    if (body.action === 'share_link') {
      const token = btoa(
          String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
        )
          .replaceAll('+', '-')
          .replaceAll('/', '_')
          .replaceAll('=', ''),
        now = new Date().toISOString();
      await db
        .prepare(
          "INSERT INTO sales_records(id,business_id,kind,data,archived,created_at,updated_at) VALUES(?,?,'proposal_link',?,0,?,?) ON CONFLICT(id) DO UPDATE SET data=CASE WHEN sales_records.archived=1 THEN excluded.data ELSE sales_records.data END,archived=0,updated_at=excluded.updated_at WHERE sales_records.business_id=? AND sales_records.kind='proposal_link'",
        )
        .bind(
          'proposal-link:' + id,
          b.id,
          JSON.stringify({ eventId: id, token }),
          now,
          now,
          b.id,
        )
        .run();
      const row = await db
        .prepare(
          "SELECT data FROM sales_records WHERE id=? AND business_id=? AND kind='proposal_link' AND archived=0",
        )
        .bind('proposal-link:' + id, b.id)
        .first<{ data: string }>();
      if (!row) throw Error('Unable to prepare the link.');
      return json({
        path: '/proposal/' + id + '?token=' + JSON.parse(row.data).token,
      });
    }
    if (body.action === 'save_invoice') {
      const value = checkedInvoice(body.invoice || {}),
        ops = await operations(id, b.id);
      if (
        JSON.stringify(ops.invoice || null) !==
        JSON.stringify(body.previous || null)
      )
        return json(
          {
            error:
              'Invoice details changed. Reopen this proposal and try again.',
          },
          409,
        );
      const expected = JSON.stringify(ops.invoice || null);
      const saved = await db
        .prepare(
          "INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_set(event_operations.data,'$.invoice',ed_json(?)) WHERE event_operations.business_id=? AND ed_json(COALESCE(ed_text(event_operations.data,'$.invoice'),'null'))=ed_json(?)",
        )
        .bind(
          id,
          b.id,
          JSON.stringify({ invoice: value }),
          JSON.stringify(value),
          b.id,
          expected,
        )
        .run();
      if (!saved.meta.changes)
        return json(
          { error: 'Invoice changed. Reopen this proposal and try again.' },
          409,
        );
      return json(await snapshot(user!.userId));
    }
    return json({ error: 'Unknown proposal action.' }, 400);
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && !/SQLITE|D1_ERROR|R2_ERROR/i.test(e.message)
            ? e.message
            : 'Unable to update proposal.',
      },
      400,
    );
  }
}
