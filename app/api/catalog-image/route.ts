import { files } from '@/server/storage';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor, snapshot } from '@/db/store';
import { rawDb } from '@/db/raw';
import { readCatalogImage } from '@/db/image-upload';
import { text } from '@/lib/crm';
export const dynamic = 'force-dynamic';
const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id'),
    db = rawDb();
  const row = await db
    .prepare(
      "SELECT r.business_id,r.name,r.kind,r.data,b.services FROM resources r JOIN businesses b ON b.id=r.business_id WHERE r.id=? AND r.archived=0 AND r.kind IN ('service_settings','package_groups')",
    )
    .bind(id)
    .first<{
      business_id: string;
      name: string;
      kind: string;
      data: string;
      services: string;
    }>();
  if (!row) return new Response('Not found', { status: 404 });
  const settings = JSON.parse(row.data),
    service = row.kind === 'service_settings' ? row.name : settings.service;
  if (!settings.imageId) return new Response('Not found', { status: 404 });
  const user = await getChatGPTUser(),
    business = user ? await businessFor(user.userId) : null;
  if (business?.id !== row.business_id) {
    const publicPackage =
      JSON.parse(row.services).includes(service) &&
      (await db
        .prepare(
          "SELECT id FROM packages WHERE business_id=? AND service=? AND COALESCE(ed_text(settings,'$.status'),'Public')='Public' AND (?='service_settings' OR COALESCE(ed_text(settings,'$.group'),'')=?) LIMIT 1",
        )
        .bind(row.business_id, service, row.kind, row.name)
        .first());
    if (!publicPackage) return new Response('Not found', { status: 404 });
  }
  const image = await files.get(
    `${row.business_id}/catalog/${settings.imageId}`,
  );
  if (!image) return new Response('Not found', { status: 404 });
  return new Response(image.body, {
    headers: {
      'Content-Type':
        image.httpMetadata?.contentType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
async function mutate(req: Request) {
  try {
    const user = await getChatGPTUser(),
      b = user ? await businessFor(user.userId) : null;
    if (!b) return reply({ error: 'Sign in first.' }, 401);
    if (
      req.headers.get('origin') &&
      req.headers.get('origin') !== new URL(req.url).origin
    )
      return reply({ error: 'Invalid origin.' }, 403);
    const url = new URL(req.url),
      service = text(url.searchParams.get('service'), 'Service', 70),
      group = url.searchParams.has('group')
        ? text(url.searchParams.get('group'), 'Group', 100, false)
        : undefined,
      kind = group === undefined ? 'service_settings' : 'package_groups',
      name = group ?? service,
      db = rawDb();
    if (!JSON.parse(String(b.services)).includes(service))
      return reply({ error: 'Service not found.' }, 404);
    const row = await db
      .prepare(
        "SELECT id,data FROM resources WHERE business_id=? AND kind=? AND name=? AND archived=0 AND (?='service_settings' OR ed_text(data,'$.service')=?)",
      )
      .bind(b.id, kind, name, kind, service)
      .first<{ id: string; data: string }>();
    if (
      group !== undefined &&
      !row &&
      !(await db
        .prepare(
          "SELECT id FROM packages WHERE business_id=? AND service=? AND COALESCE(ed_text(settings,'$.group'),'')=? LIMIT 1",
        )
        .bind(b.id, service, group)
        .first())
    )
      return reply({ error: 'Group not found.' }, 404);
    const previous = JSON.parse(row?.data || '{}'),
      imageId = req.method === 'PUT' ? crypto.randomUUID() : '';
    if (req.method === 'PUT') {
      const image = await readCatalogImage(req);
      await files.put(`${b.id}/catalog/${imageId}`, image.bytes, {
        httpMetadata: { contentType: image.mime },
      });
    }
    try {
      const now = new Date().toISOString(),
        data = JSON.stringify({
          ...previous,
          ...(group === undefined ? {} : { service }),
          imageId,
        });
      if (row)
        await db
          .prepare(
            'UPDATE resources SET data=?,updated_at=? WHERE id=? AND business_id=?',
          )
          .bind(data, now, row.id, b.id)
          .run();
      else
        await db
          .prepare(
            'INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), b.id, kind, name, data, now, now)
          .run();
    } catch (e) {
      if (imageId) await files.delete(`${b.id}/catalog/${imageId}`);
      throw e;
    }
    // Duplicated collections share immutable image bytes; replacing one leaves the other intact.
    if (
      previous.imageId &&
      !(await db
        .prepare(
          "SELECT id FROM resources WHERE business_id=? AND kind IN ('service_settings','package_groups') AND ed_text(data,'$.imageId')=? LIMIT 1",
        )
        .bind(b.id, previous.imageId)
        .first())
    ) {
      try {
        await files.delete(`${b.id}/catalog/${previous.imageId}`);
      } catch {
        console.error('Catalog image cleanup failed');
      }
    }
    return reply(await snapshot(user!.userId));
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (/Choose|Images must|Service|Group/.test(message))
      return reply({ error: message }, 400);
    return reply(
      { error: 'Unable to update the image. Please try again.' },
      503,
    );
  }
}
export const PUT = mutate;
export const DELETE = mutate;
