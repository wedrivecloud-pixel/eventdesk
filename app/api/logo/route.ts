import { files } from '@/server/storage';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor } from '@/db/store';
import { rawDb } from '@/db/raw';
export const dynamic = 'force-dynamic';
async function owner() {
  const user = await getChatGPTUser();
  return user ? businessFor(user.userId) : null;
}
export async function GET() {
  const b = await owner();
  if (!b) return new Response('Not found', { status: 404 });
  const file = await files.get(`${b.id}/logo`);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.body, {
    headers: {
      'Content-Type':
        file.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export async function PUT(req: Request) {
  const b = await owner();
  if (!b)
    return Response.json(
      { error: 'Create your business first.' },
      { status: 401 },
    );
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin)
    return new Response('Invalid origin', { status: 403 });
  if (!req.body) return new Response('Missing image', { status: 400 });
  const reader = req.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      return Response.json(
        { error: 'Logo must be under 2 MB.' },
        { status: 413 },
      );
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  const mime = req.headers.get('content-type');
  const png =
    bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (
    !(
      (mime === 'image/png' && png) ||
      (mime === 'image/jpeg' && jpg) ||
      (mime === 'image/webp' && webp)
    )
  )
    return Response.json(
      { error: 'Choose a PNG, JPEG or WebP image.' },
      { status: 400 },
    );
  await files.put(`${b.id}/logo`, bytes, {
    httpMetadata: { contentType: mime! },
  });
  await rawDb()
    .prepare(
      'INSERT INTO business_settings(business_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(business_id) DO UPDATE SET data=ed_patch(business_settings.data,excluded.data),updated_at=excluded.updated_at',
    )
    .bind(
      b.id,
      JSON.stringify({ logoVersion: crypto.randomUUID() }),
      new Date().toISOString(),
    )
    .run();
  return Response.json({ ok: true });
}
