/* Filename sanitization intentionally strips control characters. */
/* oxlint-disable no-control-regex */
import { files } from '@/server/storage';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor, operations } from '@/db/store';
import { rawDb } from '@/db/raw';
import { bookingContext } from '@/db/public-booking';
import { leadFormContext } from '@/db/lead-forms';
import { bookingQuestions } from '@/lib/manage-questions';
import { limit } from '../booking/route';
const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(req: Request) {
  const u = await getChatGPTUser(),
    b = u ? await businessFor(u.userId) : null;
  if (!b) return new Response('Not found', { status: 404 });
  const id = new URL(req.url).searchParams.get('id'),
    r = await rawDb()
      .prepare(
        "SELECT name,data FROM resources WHERE id=? AND business_id=? AND kind='response_files'",
      )
      .bind(id, b.id)
      .first<{ name: string; data: string }>();
  if (!r) return new Response('Not found', { status: 404 });
  const object = await files.get(`${String(b.id)}/responses/${id}`);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Content-Type': JSON.parse(r.data).mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    if (
      (req.headers.get('origin') && req.headers.get('origin') !== url.origin) ||
      req.headers.get('sec-fetch-site') === 'cross-site'
    )
      return json({ error: 'Invalid origin.' }, 403);
    const field = url.searchParams.get('field'),
      packageId = url.searchParams.get('packageId'),
      formId = url.searchParams.get('formId'),
      eventId = url.searchParams.get('eventId');
    let bid = '',
      scope = '',
      imageOnly = false,
      valid = false;
    if (packageId) {
      const c = await bookingContext(packageId),
        q = c
          ? bookingQuestions(c.resources, [packageId]).find(
              (q) => q.id === field,
            )
          : null;
      if (c && q) {
        bid = c.bid;
        scope = 'package:' + packageId;
        imageOnly = q.type === 'Image Upload Field';
        valid = imageOnly || q.type === 'File Upload Field';
      }
    } else if (formId) {
      const c = await leadFormContext(formId),
        q = c?.questions.find((q) => q.id === field);
      if (c && q) {
        bid = c.b.id;
        scope = 'form:' + formId;
        imageOnly = q.type === 'Image Upload Field';
        valid = imageOnly || q.type === 'File Upload Field';
      }
    } else if (eventId) {
      const u = await getChatGPTUser(),
        b = u ? await businessFor(u.userId) : null;
      if (b) {
        const e = await rawDb()
          .prepare('SELECT id FROM events WHERE id=? AND business_id=?')
          .bind(eventId, b.id)
          .first();
        if (e) {
          const ops = await operations(eventId, b.id),
            q = [...(ops.questions||[]),...(ops.bookingFields||[]),...(ops.designCollections||[]).flatMap((c: {fields: {id:string;type:string}[]}) => c.fields)].find((q: { id: string }) => q.id === field);
          if (q) {
            bid = String(b.id);
            scope = 'event:' + eventId;
            imageOnly = q.type === 'Image Upload Field';
            valid = imageOnly || q.type === 'File Upload Field';
          }
        }
      }
    }
    if (!valid)
      return json({ error: 'This upload field is unavailable.' }, 404);
    await limit(req, bid, 'submit');
    if (!req.body) throw Error('Choose a file.');
    const reader = req.body.getReader(),
      parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 10 * 1024 * 1024) {
        await reader.cancel();
        return json({ error: 'Maximum file size is 10 MB.' }, 413);
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const p of parts) {
      bytes.set(p, offset);
      offset += p.length;
    }
    const mime = req.headers.get('content-type') || '',
      decode = (a: number, b: number) =>
        new TextDecoder().decode(bytes.slice(a, b));
    if (
      !(
        size > 24 &&
        ((mime === 'image/png' &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) ||
          (mime === 'image/jpeg' &&
            bytes[0] === 255 &&
            bytes[1] === 216 &&
            bytes[2] === 255) ||
          (mime === 'image/webp' &&
            decode(0, 4) === 'RIFF' &&
            decode(8, 12) === 'WEBP') ||
          (!imageOnly &&
            mime === 'application/pdf' &&
            decode(0, 5) === '%PDF-'))
      )
    )
      throw Error(
        'Choose a PNG, JPEG, WebP image' +
          (imageOnly ? '.' : ' or PDF document.'),
      );
    const id = crypto.randomUUID(),
      name = (url.searchParams.get('name') || 'Attachment')
        .replace(/[\u0000-\u001f\\/]/g, ' ')
        .slice(0, 120),
      now = new Date().toISOString(),
      key = `${bid}/responses/${id}`;
    await files.put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      const r = await rawDb()
        .prepare(
          "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) SELECT ?,?,'response_files',?,?,?,? WHERE (SELECT COUNT(*) FROM resources WHERE business_id=? AND kind='response_files')<10000",
        )
        .bind(
          id,
          bid,
          name,
          JSON.stringify({ mime, size, scope, field }),
          now,
          now,
          bid,
        )
        .run();
      if (!r.meta.changes)
        throw Error('This business has reached its attachment limit.');
    } catch (e) {
      await files.delete(key);
      throw e;
    }
    return json({ id, name });
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to upload.';
    return json(
      {
        error:
          m === 'RATE_LIMIT'
            ? 'Too many uploads. Please try again in 15 minutes.'
            : /D1_|R2_|SQLITE/.test(m)
              ? 'Unable to upload file.'
              : m,
      },
      m === 'RATE_LIMIT' ? 429 : 400,
    );
  }
}
