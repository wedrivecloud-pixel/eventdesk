import { files } from '@/server/storage';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor } from '@/db/store';
import { rawDb } from '@/db/raw';
export const dynamic = 'force-dynamic';
const result = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function owner() {
  const u = await getChatGPTUser();
  return u ? businessFor(u.userId) : null;
}
async function images(bid: unknown, pid: unknown) {
  return (
    await rawDb()
      .prepare(
        'SELECT id,package_id,is_primary,alt FROM package_images WHERE business_id=? AND package_id=? ORDER BY is_primary DESC,created_at ASC',
      )
      .bind(bid, pid)
      .all()
  ).results;
}
export async function GET(req: Request) {
  const b = await owner();
  if (!b) return new Response('Not found', { status: 404 });
  const id = new URL(req.url).searchParams.get('id');
  const row = await rawDb()
    .prepare(
      'SELECT package_id FROM package_images WHERE id=? AND business_id=?',
    )
    .bind(id, b.id)
    .first<{ package_id: string }>();
  if (!row) return new Response('Not found', { status: 404 });
  const obj = await files.get(`${b.id}/packages/${row.package_id}/${id}`);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type':
        obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
async function mutate(req: Request) {
  try {
    const b = await owner();
    if (!b) return result({ error: 'Sign in first.' }, 401);
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return result({ error: 'Invalid origin.' }, 403);
    const db = rawDb(),
      url = new URL(req.url),
      pid = url.searchParams.get('package');
    const p = await db
      .prepare('SELECT id,name FROM packages WHERE id=? AND business_id=?')
      .bind(pid, b.id)
      .first<{ id: string; name: string }>();
    if (!p) return result({ error: 'Package not found.' }, 404);
    if (req.method === 'PUT') {
      if (!req.body) return result({ error: 'Choose an image.' }, 400);
      const reader = req.body.getReader(),
        parts: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 5 * 1024 * 1024) {
          await reader.cancel();
          return result({ error: 'Images must be under 5 MB.' }, 413);
        }
        parts.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const x of parts) {
        bytes.set(x, offset);
        offset += x.length;
      }
      const mime = req.headers.get('content-type'),
        decode = (a: number, b: number) =>
          new TextDecoder().decode(bytes.slice(a, b));
      const png =
          size > 24 &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x),
        jpg =
          size > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
        webp = size > 16 && decode(0, 4) === 'RIFF' && decode(8, 12) === 'WEBP';
      if (
        !(
          (mime === 'image/png' && png) ||
          (mime === 'image/jpeg' && jpg) ||
          (mime === 'image/webp' && webp)
        )
      )
        return result({ error: 'Choose a PNG, JPEG or WebP image.' }, 400);
      const id = crypto.randomUUID(),
        key = `${b.id}/packages/${pid}/${id}`;
      await files.put(key, bytes, { httpMetadata: { contentType: mime! } });
      try {
        const added = await db
          .prepare(
            'INSERT INTO package_images(id,business_id,package_id,is_primary,alt,created_at) SELECT ?,?,?,CASE WHEN COUNT(*)=0 THEN 1 ELSE 0 END,?,? FROM package_images WHERE package_id=? AND business_id=? HAVING COUNT(*)<10',
          )
          .bind(id, b.id, pid, p.name, new Date().toISOString(), pid, b.id)
          .run();
        if (!added.meta.changes) {
          await files.delete(key);
          return result(
            { error: 'Each package can have up to 10 photos.' },
            400,
          );
        }
      } catch (e) {
        await files.delete(key);
        throw e;
      }
    } else {
      const id = url.searchParams.get('id');
      const row = await db
        .prepare(
          'SELECT id FROM package_images WHERE id=? AND business_id=? AND package_id=?',
        )
        .bind(id, b.id, pid)
        .first();
      if (!row) return result({ error: 'Image not found.' }, 404);
      if (req.method === 'PATCH')
        await db
          .prepare(
            'UPDATE package_images SET is_primary=CASE WHEN id=? THEN 1 ELSE 0 END WHERE business_id=? AND package_id=?',
          )
          .bind(id, b.id, pid)
          .run();
      else {
        await db.batch([
          db
            .prepare(
              'DELETE FROM package_images WHERE id=? AND business_id=? AND package_id=?',
            )
            .bind(id, b.id, pid),
          db
            .prepare(
              'UPDATE package_images SET is_primary=1 WHERE id=(SELECT id FROM package_images WHERE business_id=? AND package_id=? ORDER BY is_primary DESC,created_at LIMIT 1)',
            )
            .bind(b.id, pid),
        ]);
        await files.delete(`${b.id}/packages/${pid}/${id}`);
      }
    }
    return result({ images: await images(b.id, pid) });
  } catch {
    return result(
      { error: 'Unable to update package photos. Please try again.' },
      503,
    );
  }
}
export const PUT = mutate;
export const PATCH = mutate;
export const DELETE = mutate;
