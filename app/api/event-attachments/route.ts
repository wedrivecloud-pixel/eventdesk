import { files as objectStore } from '@/server/storage';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor } from '@/db/store';
import { rawDb } from '@/db/raw';
import { proposalAccess } from '@/db/proposals';
import { text } from '@/lib/crm';
import { safeAttachmentUrl, type EventAttachment } from '@/lib/proposal';
const json = (v: unknown, status = 200) =>
  Response.json(v, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
async function list(bid: unknown, id: string) {
  return (
    await rawDb()
      .prepare(
        "SELECT id,data,updated_at FROM sales_records WHERE business_id=? AND kind='event_attachment' AND archived=0 AND ed_text(data,'$.eventId')=? ORDER BY created_at",
      )
      .bind(bid, id)
      .all<{ id: string; data: string; updated_at: string }>()
  ).results.map((r) => ({
    id: r.id,
    ...JSON.parse(r.data),
    updatedAt: r.updated_at,
  }));
}
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams,
      eventId = q.get('event') || '',
      id = q.get('id'),
      access = await proposalAccess(eventId, q.get('token') || '');
    if (!access) return json({ error: 'Attachment unavailable.' }, 404);
    const files = await list(access.bid, eventId);
    if (!id) {
      if (!access.owner) return json({ error: 'Attachment unavailable.' }, 404);
      return json({ files });
    }
    const f = files.find((f) => f.id === id);
    if (!f || (!access.owner && !f.clientView) || f.kind !== 'Document')
      return json({ error: 'Attachment unavailable.' }, 404);
    const file = await objectStore.get(access.bid + '/event-attachments/' + id);
    if (!file) return json({ error: 'Attachment unavailable.' }, 404);
    return new Response(file.body, {
      headers: {
        'Content-Type': f.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return json({ error: 'Attachment unavailable.' }, 404);
  }
}
export async function POST(req: Request) {
  return write(req, false);
}
export async function PUT(req: Request) {
  return write(req, true);
}
async function write(req: Request, upload: boolean) {
  try {
    const user = await getChatGPTUser(),
      b = user && (await businessFor(user.userId));
    if (!b) return json({ error: 'Sign in first.' }, 401);
    if (
      req.headers.get('sec-fetch-site') === 'cross-site' ||
      (req.headers.get('origin') &&
        req.headers.get('origin') !== new URL(req.url).origin)
    )
      return json({ error: 'Invalid origin.' }, 403);
    const q = new URL(req.url).searchParams;
    let body: Record<string, unknown> = {};
    if (!upload) {
      const raw = await req.text();
      if (raw.length > 12000) return json({ error: 'Request too large.' }, 413);
      body = JSON.parse(raw);
    }
    const eventId = text(upload ? q.get('event') : body.eventId, 'Event', 100),
      db = rawDb();
    if (
      !(await db
        .prepare(
          "SELECT id FROM events WHERE id=? AND business_id=? AND lifecycle='Active' AND status IN ('proposal','confirmed')",
        )
        .bind(eventId, b.id)
        .first())
    )
      return json({ error: 'Proposal unavailable.' }, 404);
    if (body.action === 'update' || body.action === 'remove') {
      const row = await db
        .prepare(
          "SELECT data FROM sales_records WHERE id=? AND business_id=? AND kind='event_attachment' AND archived=0 AND ed_text(data,'$.eventId')=?",
        )
        .bind(body.id, b.id, eventId)
        .first<{ data: string }>();
      if (!row) return json({ error: 'Attachment unavailable.' }, 404);
      const d = JSON.parse(row.data);
      if (body.action === 'update') {
        d.name = text(body.name, 'Name', 200);
        if (
          typeof body.clientView !== 'boolean' ||
          typeof body.staffView !== 'boolean'
        )
          throw Error('Choose valid visibility options.');
        d.clientView = body.clientView;
        d.staffView = body.staffView;
        if (d.kind === 'Link') d.url = safeAttachmentUrl(body.url);
      }
      const result = await db
        .prepare(
          "UPDATE sales_records SET data=?,archived=?,updated_at=? WHERE id=? AND business_id=? AND kind='event_attachment' AND updated_at=?",
        )
        .bind(
          JSON.stringify(d),
          body.action === 'remove' ? 1 : 0,
          new Date().toISOString(),
          body.id,
          b.id,
          text(body.updatedAt, 'Attachment version', 40),
        )
        .run();
      if (!result.meta.changes)
        return json(
          { error: 'Attachment changed. Refresh and try again.' },
          409,
        );
      return json({ files: await list(b.id, eventId) });
    }
    if (!upload && body.action !== 'add_link')
      throw Error('Unknown attachment action.');
    const id = crypto.randomUUID(),
      now = new Date().toISOString(),
      key = b.id + '/event-attachments/' + id;
    const d: Omit<EventAttachment, 'id' | 'updatedAt'> = {
      eventId,
      name: text(upload ? q.get('name') : body.name, 'Name', 200),
      kind: upload ? 'Document' : 'Link',
      clientView: false,
      staffView: true,
    };
    if (upload) {
      if (!req.body) throw Error('Choose a file.');
      const reader = req.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 5 * 1024 * 1024) {
          await reader.cancel();
          return json({ error: 'Files must be under 5 MB.' }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const p of chunks) {
        bytes.set(p, offset);
        offset += p.length;
      }
      const mime = req.headers.get('content-type'),
        valid =
          (mime === 'application/pdf' &&
            new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') ||
          (mime === 'image/png' &&
            size > 24 &&
            [137, 80, 78, 71, 13, 10, 26, 10].every(
              (v, i) => bytes[i] === v,
            )) ||
          (mime === 'image/jpeg' &&
            size > 4 &&
            bytes[0] === 255 &&
            bytes[1] === 216 &&
            bytes[2] === 255);
      if (!valid) throw Error('Choose a PDF, PNG or JPEG file.');
      d.filename = (q.get('filename') || d.name)
        // Reject control bytes in download filenames, including line breaks.
        // eslint-disable-next-line no-control-regex
        .replace(/[\r\n\x00-\x1f]/g, '')
        .slice(0, 200);
      d.size = size;
      d.contentType = mime;
      await objectStore.put(key, bytes, { httpMetadata: { contentType: mime! } });
    } else d.url = safeAttachmentUrl(body.url);
    try {
      const saved = await db
        .prepare(
          "INSERT INTO sales_records(id,business_id,kind,data,created_at,updated_at) SELECT ?,?,'event_attachment',?,?,? WHERE (SELECT COUNT(*) FROM sales_records WHERE business_id=? AND kind='event_attachment' AND archived=0 AND ed_text(data,'$.eventId')=?)<30",
        )
        .bind(id, b.id, JSON.stringify(d), now, now, b.id, eventId)
        .run();
      if (!saved.meta.changes)
        throw Error('Each proposal supports up to 30 attachments.');
    } catch (e) {
      if (upload) await objectStore.delete(key);
      throw e;
    }
    return json({ files: await list(b.id, eventId) });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && !/SQLITE|D1_ERROR|R2_ERROR/i.test(e.message)
            ? e.message
            : 'Unable to save attachment.',
      },
      400,
    );
  }
}
