import { packageSettings } from '@/lib/package-config';
import { rawDb } from './raw';
import { mergedSettings, type Resource } from '@/lib/settings';
import { materializeExpenses } from './sales';
export async function businessFor(owner: string) {
  return rawDb()
    .prepare('SELECT * FROM businesses WHERE owner_id = ?')
    .bind(owner)
    .first<Record<string, unknown>>();
}
export async function configuration(bid: unknown) {
  const db = rawDb();
  const [s, r] = await Promise.all([
    db
      .prepare('SELECT data FROM business_settings WHERE business_id=?')
      .bind(bid)
      .first<{ data: string }>(),
    db
      .prepare(
        'SELECT id,kind,name,data,archived,created_at FROM resources WHERE business_id=? ORDER BY name',
      )
      .bind(bid)
      .all(),
  ]);
  return {
    settings: mergedSettings(s ? JSON.parse(s.data) : {}),
    resources: r.results.map((x) => ({
      ...x,
      data: JSON.parse(String(x.data)),
    })) as Resource[],
  };
}
export async function operations(id: unknown, bid: unknown) {
  const o = await rawDb()
    .prepare(
      'SELECT data FROM event_operations WHERE event_id=? AND business_id=?',
    )
    .bind(id, bid)
    .first<{ data: string }>();
  return o ? JSON.parse(o.data) : {};
}
export async function snapshot(owner: string) {
  const business = await businessFor(owner);
  if (!business)
    return {
      business: null,
      packages: [],
      events: [],
      settings: mergedSettings(),
      resources: [],
      payments: [],
    };
  const db = rawDb();
  const persistedSettings = await db
    .prepare('SELECT data FROM business_settings WHERE business_id=?')
    .bind(business.id)
    .first<{ data: string }>();
  await materializeExpenses(
    business.id,
    JSON.parse(persistedSettings?.data || '{}').timezone ||
      'America/Los_Angeles',
  );
  const [p, e, o, pay, c, images, sales] = await Promise.all([
    db
      .prepare(
        'SELECT id,name,service,price,duration,description,settings FROM packages WHERE business_id=? ORDER BY created_at DESC',
      )
      .bind(business.id)
      .all(),
    db
      .prepare('SELECT * FROM events WHERE business_id=? ORDER BY date ASC')
      .bind(business.id)
      .all(),
    db
      .prepare('SELECT event_id,data FROM event_operations WHERE business_id=?')
      .bind(business.id)
      .all(),
    db
      .prepare(
        'SELECT * FROM payments WHERE business_id=? ORDER BY date DESC,created_at DESC',
      )
      .bind(business.id)
      .all(),
    configuration(business.id),
    db
      .prepare(
        'SELECT id,package_id,is_primary,alt FROM package_images WHERE business_id=? ORDER BY is_primary DESC,created_at ASC',
      )
      .bind(business.id)
      .all(),
    db
      .prepare(
        'SELECT id,kind,data,archived,created_at,updated_at FROM sales_records WHERE business_id=? ORDER BY created_at DESC',
      )
      .bind(business.id)
      .all(),
  ]);
  const ops = Object.fromEntries(
    o.results.map((x) => [String(x.event_id), JSON.parse(String(x.data))]),
  );
  return {
    business: {
      id: business.id,
      name: business.name,
      email: business.email,
      phone: business.phone,
      services: JSON.parse(String(business.services)),
    },
    packages: p.results.map((x) => ({
      ...x,
      settings: packageSettings(
        JSON.parse(String(x.settings)),
        String(x.duration),
      ),
      images: images.results.filter((i) => i.package_id === x.id),
    })),
    events: e.results.map((x) => ({
      ...x,
      items: JSON.parse(String(x.items)),
      operations: ops[String(x.id)] || {},
    })),
    payments: pay.results,
    sales: sales.results.map((r) => ({
      ...r,
      data: JSON.parse(String(r.data)),
    })),
    ...c,
  };
}
