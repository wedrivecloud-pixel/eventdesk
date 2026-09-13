import { rawDb } from './raw';
import { configuration } from './store';
import { text, email } from '@/lib/crm';
import { brandRecords, checkedBrandSocials, type Brand } from '@/lib/brands';

// Brands share their owner's workspace. No client-supplied business ID is used.
export async function brandAction(bid: unknown, body: Record<string, unknown>) {
  if (
    !['save_brand', 'archive_brand', 'restore_brand'].includes(
      String(body.action),
    )
  )
    return false;
  const db = rawDb(),
    config = await configuration(bid),
    rows = brandRecords(config.resources, true),
    id = body.id ? text(body.id, 'Brand ID', 100) : '',
    existing = rows.find((r) => r.id === id),
    now = new Date().toISOString();
  if (id && !existing) throw Error('NOT_FOUND');
  if (body.action !== 'save_brand') {
    if (!existing) throw Error('NOT_FOUND');
    await db
      .prepare(
        "UPDATE resources SET archived=?,updated_at=? WHERE id=? AND business_id=? AND kind='brands'",
      )
      .bind(body.action === 'archive_brand' ? 1 : 0, now, id, bid)
      .run();
    return true;
  }
  if (existing?.archived) throw Error('Restore this brand before editing it.');
  const source = body.data;
  if (!source || typeof source !== 'object' || Array.isArray(source))
    throw Error('Enter the brand details.');
  const d = source as Record<string, unknown>,
    name = text(body.name, 'Brand name', 120);
  if (
    rows.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())
  )
    throw Error('A brand with this name already exists.');
  const website = text(d.website ?? '', 'Website', 500, false);
  if (website && !/^https?:\/\//i.test(website))
    throw Error('Website must start with https:// or http://.');
  if (website) {
    try {
      new URL(website);
    } catch {
      throw Error('Enter a valid website URL.');
    }
  }
  const color = text(d.color, 'Brand color', 7);
  if (!/^#[0-9a-f]{6}$/i.test(color))
    throw Error('Choose a valid brand color.');
  const logoId = text(d.logoId ?? '', 'Logo', 100, false);
  if (
    logoId &&
    !config.resources.some(
      (r) =>
        r.id === logoId &&
        r.kind === 'media' &&
        !r.archived &&
        ['image/png', 'image/jpeg', 'image/webp'].includes(String(r.data.mime)),
    )
  )
    throw Error('Choose an image from your media library.');
  if (!['all', 'selected'].includes(String(d.packageMode)))
    throw Error('Choose which packages this brand offers.');
  if (!Array.isArray(d.packageIds) || d.packageIds.length > 1000)
    throw Error('Choose valid packages.');
  const packageIds = [
    ...new Set(d.packageIds.map((p) => text(p, 'Package', 100))),
  ];
  const packages = (
    await db
      .prepare('SELECT id FROM packages WHERE business_id=?')
      .bind(bid)
      .all<{ id: string }>()
  ).results;
  if (packageIds.some((p) => !packages.some((x) => x.id === p)))
    throw Error('Choose packages from your business.');
  const brand: Omit<Brand, 'id' | 'name'> = {
    ...checkedBrandSocials({ ...existing?.data, ...d }),
    email: email(d.email),
    phone: text(d.phone ?? '', 'Phone', 40, false),
    address: text(d.address ?? '', 'Address', 1000, false),
    website,
    color,
    logoId,
    signature: text(d.signature ?? '', 'Signature', 3000, false),
    footer: text(d.footer ?? '', 'Proposal footer', 3000, false),
    headline: text(d.headline ?? '', 'Booking headline', 150, false),
    subheading: text(d.subheading ?? '', 'Booking introduction', 1000, false),
    packageMode: d.packageMode as Brand['packageMode'],
    packageIds,
  };
  if (existing) {
    await db
      .prepare(
        "UPDATE resources SET name=?,data=?,updated_at=? WHERE id=? AND business_id=? AND kind='brands' AND archived=0",
      )
      .bind(name, JSON.stringify(brand), now, id, bid)
      .run();
  } else {
    const result = await db
      .prepare(
        "INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) SELECT ?,?,'brands',?,?,?,? WHERE (SELECT COUNT(*) FROM resources WHERE business_id=? AND kind='brands')<50",
      )
      .bind(
        crypto.randomUUID(),
        bid,
        name,
        JSON.stringify(brand),
        now,
        now,
        bid,
      )
      .run();
    if (!result.meta.changes)
      throw Error('Your workspace has reached its 50-brand limit.');
  }
  return true;
}
