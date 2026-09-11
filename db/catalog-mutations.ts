import type { PreparedStatement } from '@/db/raw';
import { files } from '@/server/storage';
import { rawDb } from './raw';
import type { PackageRecord } from '@/lib/crm';

// Copy files independently so deleting or editing a source never changes its copy.
export async function cloneCatalog(
  bid: string,
  targets: PackageRecord[],
  destination: (p: PackageRecord) => {
    name: string;
    service: string;
    group: string;
  },
  extra: (ids: Map<string, string>) => PreparedStatement[],
) {
  if (targets.length > 100)
    throw Error(
      'Duplicate up to 100 packages at a time. Split larger services into groups.',
    );
  const db = rawDb(),
    now = new Date().toISOString(),
    ids = new Map(targets.map((p) => [p.id, crypto.randomUUID()])),
    writes: PreparedStatement[] = [],
    keys: string[] = [];
  try {
    for (const p of targets) {
      const id = ids.get(p.id)!,
        to = destination(p);
      writes.push(
        db
          .prepare(
            'INSERT INTO packages(id,business_id,name,service,price,duration,description,settings,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            id,
            bid,
            to.name,
            to.service,
            p.price,
            p.duration,
            p.description,
            JSON.stringify({
              ...p.settings,
              status: 'Private',
              group: to.group,
            }),
            now,
          ),
      );
      const images = (
        await db
          .prepare(
            'SELECT * FROM package_images WHERE business_id=? AND package_id=?',
          )
          .bind(bid, p.id)
          .all<{ id: string; is_primary: number; alt: string }>()
      ).results;
      for (const image of images) {
        const source = await files.get(
          `${bid}/packages/${p.id}/${image.id}`,
        );
        if (!source)
          throw Error(
            'A source photo is missing. Replace it before duplicating.',
          );
        const imageId = crypto.randomUUID(),
          key = `${bid}/packages/${id}/${imageId}`;
        await files.put(key, source.body, {
          httpMetadata: source.httpMetadata,
        });
        keys.push(key);
        writes.push(
          db
            .prepare(
              'INSERT INTO package_images(id,business_id,package_id,is_primary,alt,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(imageId, bid, id, image.is_primary, image.alt, now),
        );
      }
    }
    writes.push(...extra(ids));
    if (writes.length) await db.batch(writes);
  } catch (e) {
    await Promise.allSettled(keys.map((key) => files.delete(key)));
    throw e;
  }
}
export async function deleteCatalogPackages(
  bid: string,
  targets: PackageRecord[],
  extra: PreparedStatement[] = [],
) {
  const db = rawDb(),
    ids = JSON.stringify(targets.map((p) => p.id));
  const collectionImages = extra.length
    ? (
        await db
          .prepare(
            "SELECT DISTINCT ed_text(data,'$.imageId') AS imageId FROM resources WHERE business_id=? AND kind IN ('service_settings','package_groups') AND ed_text(data,'$.imageId') IS NOT NULL",
          )
          .bind(bid)
          .all<{ imageId: string }>()
      ).results
    : [];
  const photos = (
    await db
      .prepare(
        'SELECT id,package_id FROM package_images WHERE business_id=? AND package_id IN (SELECT value FROM ed_each(?))',
      )
      .bind(bid, ids)
      .all<{ id: string; package_id: string }>()
  ).results;
  await db.batch([
    db
      .prepare(
        'DELETE FROM package_images WHERE business_id=? AND package_id IN (SELECT value FROM ed_each(?))',
      )
      .bind(bid, ids),
    db
      .prepare(
        'DELETE FROM packages WHERE business_id=? AND id IN (SELECT value FROM ed_each(?))',
      )
      .bind(bid, ids),
    ...extra,
  ]);
  // Removed metadata immediately revokes reads even if object cleanup needs another attempt.
  const keys = photos.map((p) => `${bid}/packages/${p.package_id}/${p.id}`);
  for (const { imageId } of collectionImages) {
    if (
      imageId &&
      !(await db
        .prepare(
          "SELECT id FROM resources WHERE business_id=? AND kind IN ('service_settings','package_groups') AND ed_text(data,'$.imageId')=? LIMIT 1",
        )
        .bind(bid, imageId)
        .first())
    )
      keys.push(`${bid}/catalog/${imageId}`);
  }
  for (let i = 0; i < keys.length; i += 1000) {
    try {
      await files.delete(keys.slice(i, i + 1000));
    } catch {
      console.error('Deleted catalog image cleanup failed');
    }
  }
}
