import { files } from '@/server/storage';
import { bookingContext } from '@/db/public-booking';
import { rawDb } from '@/db/raw';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const url = new URL(req.url),
    id = url.searchParams.get('package');
  if (!id || id.length > 100) return new Response('Not found', { status: 404 });
  const c = await bookingContext(id);
  if (!c) return new Response('Not found', { status: 404 });
  let key = '';
  if (url.searchParams.get('logo') === '1') key = c.bid + '/logo';
  else {
    const image = url.searchParams.get('image');
    const row = await rawDb()
      .prepare(
        'SELECT id FROM package_images WHERE id=? AND package_id=? AND business_id=?',
      )
      .bind(image, c.p.id, c.bid)
      .first();
    if (!row) return new Response('Not found', { status: 404 });
    key = `${c.bid}/packages/${c.p.id}/${image}`;
  }
  const file = await files.get(key);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.body, {
    headers: {
      'Content-Type':
        file.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
