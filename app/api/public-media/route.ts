import { files } from '@/server/storage';
import { rawDb } from '@/db/raw';
import { publicBusiness, publicGalleryRows } from '@/db/manage-public';
import { details, extraAvailable } from '@/lib/manage-config';
import { bookingContext } from '@/db/public-booking';
export async function GET(req: Request) {
  const url = new URL(req.url),
    bid = url.searchParams.get('business') || '',
    id = url.searchParams.get('id') || '',
    itemId = url.searchParams.get('item') || '',
    pid = url.searchParams.get('package');
  const b = await publicBusiness(bid);
  if (!b) return new Response('Not found', { status: 404 });
  const r = b.resources.find((r) => r.id === itemId && !r.archived);
  if (
    !r ||
    !['addons', 'backdrops', 'designs', 'staff', 'booking_presets'].includes(
      r.kind,
    ) ||
    !details(r).images.includes(id)
  )
    return new Response('Not found', { status: 404 });
  let allowed = publicGalleryRows(b.resources, r.kind, b.publicPackageIds).some(
    (x) => x.id === r.id,
  );
  if (pid && !allowed) {
    const c = await bookingContext(pid);
    allowed =
      !!c &&
      c.bid === bid &&
      ['addons', 'backdrops', 'booking_presets'].includes(r.kind) &&
      extraAvailable(r, b.resources, [pid]);
  }
  if (!allowed) return new Response('Not found', { status: 404 });
  const file = await rawDb()
    .prepare(
      "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='media' AND archived=0",
    )
    .bind(id, bid)
    .first<{ data: string }>();
  if (!file) return new Response('Not found', { status: 404 });
  const mime = JSON.parse(file.data).mime;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime))
    return new Response('Not found', { status: 404 });
  const object = await files.get(`${bid}/media/${id}`);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
