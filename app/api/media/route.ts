/* Filename sanitization intentionally strips control characters. */
/* oxlint-disable no-control-regex */
import { files } from '@/server/storage';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor, configuration } from '@/db/store';
import { rawDb } from '@/db/raw';
import { details } from '@/lib/manage-config';
const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
async function owner() {
  const u = await getChatGPTUser();
  return u ? businessFor(u.userId) : null;
}
export async function GET(req: Request) {
  const b = await owner();
  if (!b) return new Response('Not found', { status: 404 });
  const id = new URL(req.url).searchParams.get('id');
  const r = await rawDb()
    .prepare(
      "SELECT name,data FROM resources WHERE id=? AND business_id=? AND kind='media' AND archived=0",
    )
    .bind(id, b.id)
    .first<{ name: string; data: string }>();
  if (!r) return new Response('Not found', { status: 404 });
  const obj = await files.get(`${String(b.id)}/media/${id}`);
  if (!obj) return new Response('Not found', { status: 404 });
  const d = JSON.parse(r.data);
  return new Response(obj.body, {
    headers: {
      'Content-Type': d.mime,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${d.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(r.name)}`,
    },
  });
}
export async function PUT(req: Request) {
  try {
    const b = await owner();
    if (!b) return json({ error: 'Sign in first.' }, 401);
    if (
      req.headers.get('origin') &&
      req.headers.get('origin') !== new URL(req.url).origin
    )
      return json({ error: 'Invalid origin.' }, 403);
    if (!req.body) return json({ error: 'Choose a file.' }, 400);
    const reader = req.body.getReader(),
      parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 10 * 1024 * 1024) {
        await reader.cancel();
        return json({ error: 'Files must be under 10 MB.' }, 413);
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    const mime = req.headers.get('content-type') || '',
      decode = (a: number, b: number) =>
        new TextDecoder().decode(bytes.slice(a, b));
    const valid =
      size > 24 &&
      ((mime === 'image/png' &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x)) ||
        (mime === 'image/jpeg' &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255) ||
        (mime === 'image/webp' &&
          decode(0, 4) === 'RIFF' &&
          decode(8, 12) === 'WEBP') ||
        (mime === 'application/pdf' && decode(0, 5) === '%PDF-'));
    if (!valid)
      return json(
        { error: 'Choose a PNG, JPEG, WebP image or PDF document.' },
        400,
      );
    const id = crypto.randomUUID(),
      name = (new URL(req.url).searchParams.get('name') || 'Uploaded file')
        .replace(/[\u0000-\u001f\\/]/g, ' ')
        .slice(0, 120),
      now = new Date().toISOString(),
      key = `${String(b.id)}/media/${id}`;
    await files.put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      const added = await rawDb()
        .prepare(
          "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) SELECT ?,?,'media',?,?,?,? WHERE (SELECT COUNT(*) FROM resources WHERE business_id=? AND kind='media' AND archived=0)<1000",
        )
        .bind(id, b.id, name, JSON.stringify({ mime, size }), now, now, b.id)
        .run();
      if (!added.meta.changes)
        throw Error('The media library has reached its 1,000-file limit.');
    } catch (e) {
      await files.delete(key);
      throw e;
    }
    return json({
      file: { id, kind: 'media', name, data: { mime, size }, archived: 0 },
    });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && !e.message.includes('D1_')
            ? e.message
            : 'Unable to upload file.',
      },
      400,
    );
  }
}
export async function DELETE(req: Request) {
  const b = await owner();
  if (!b) return json({ error: 'Sign in first.' }, 401);
  if (
    req.headers.get('origin') &&
    req.headers.get('origin') !== new URL(req.url).origin
  )
    return json({ error: 'Invalid origin.' }, 403);
  const id = new URL(req.url).searchParams.get('id'),
    { resources, settings } = await configuration(b.id);
  if (
    settings.invoiceLogoId === id || resources.some((r) => {
      const d = details(r);
      return (r.kind === 'brands' && (r.data.logoId === id || r.data.invoiceLogoId === id)) || d.images.includes(id || '') || d.attachments.includes(id || '');
    })
  )
    return json(
      {
        error:
          'This file is used by a record. Remove it from that record first.',
      },
      409,
    );
  const changed = await rawDb()
    .prepare(
      "UPDATE resources SET archived=1 WHERE id=? AND business_id=? AND kind='media'",
    )
    .bind(id, b.id)
    .run();
  if (!changed.meta.changes) return json({ error: 'File not found.' }, 404);
  // Keep the stored object for historical event attachments and restore safety.
  return json({ ok: true });
}
