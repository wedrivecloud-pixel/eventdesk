import { files } from '@/server/storage';
import { proposalAccess } from '@/db/proposals';
import { rawDb } from '@/db/raw';
import { proposalClientData } from '@/db/proposal-options';
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams,
      access = await proposalAccess(q.get('event') || '', q.get('token') || '');
    if (!access) return new Response('Not found', { status: 404 });
    const id = q.get('id');
    let key = '',
      mime = '';
    if (q.get('logo') === '1') {
      key = access.bid + '/logo';
    } else if (q.get('package')) {
      const pid = q.get('package');
      if (!id || !access.event.items.some((p) => p.id === pid))
        return new Response('Not found', { status: 404 });
      const found = await rawDb()
        .prepare(
          'SELECT id FROM package_images WHERE id=? AND package_id=? AND business_id=?',
        )
        .bind(id, pid, access.bid)
        .first();
      if (!found) return new Response('Not found', { status: 404 });
      key = access.bid + '/packages/' + pid + '/' + id;
    } else {
      let permitted =
        !!id &&
        !!access.event.operations?.quote?.presentation?.images.includes(id);
      if (q.get('extra') && id) {
        const { client } = await proposalClientData(
          access,
          q.get('token') || '',
        );
        const candidates = [...client.options, ...client.summary.extras];
        permitted = candidates.some(
          (x) =>
            x.id === q.get('extra') &&
            x.imageUrl &&
            new URL(x.imageUrl, req.url).searchParams.get('id') === id,
        );
      }
      if (!id || !permitted) return new Response('Not found', { status: 404 });
      const r = await rawDb()
        .prepare(
          "SELECT data FROM resources WHERE id=? AND business_id=? AND kind='media' AND archived=0",
        )
        .bind(id, access.bid)
        .first<{ data: string }>();
      if (!r) return new Response('Not found', { status: 404 });
      mime = JSON.parse(r.data).mime;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime))
        return new Response('Not found', { status: 404 });
      key = access.bid + '/media/' + id;
    }
    const file = await files.get(key);
    if (!file) return new Response('Not found', { status: 404 });
    if (
      q.get('package') &&
      !['image/png', 'image/jpeg', 'image/webp'].includes(
        file.httpMetadata?.contentType || '',
      )
    )
      return new Response('Not found', { status: 404 });
    return new Response(file.body, {
      headers: {
        'Content-Type':
          mime || file.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
