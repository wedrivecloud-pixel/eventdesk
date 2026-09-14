import { files } from '@/server/storage';
import { rawDb } from '@/db/raw';
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams,
    bid = q.get('business') || '',
    id = q.get('brand') || '';
  if (!bid || !id || bid.length > 100 || id.length > 100)
    return new Response('Not found', { status: 404 });
  const r = await rawDb()
    .prepare(
      "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='brands' AND archived=0",
    )
    .bind(id, bid)
    .first<{ data: string }>();
  if (!r) return new Response('Not found', { status: 404 });
  const logo = JSON.parse(r.data).logoId;
  if (!logo) return new Response('Not found', { status: 404 });
  const media = await rawDb()
    .prepare(
      "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='media'",
    )
    .bind(logo, bid)
    .first<{ data: string }>();
  const mime = media ? JSON.parse(media.data).mime : '';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime))
    return new Response('Not found', { status: 404 });
  const file = await files.get(bid + '/media/' + logo);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.body, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
