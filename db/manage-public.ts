import { rawDb } from './raw';
import { configuration } from './store';
import { designIds } from '@/lib/design-collections';
import {
  appliesTo,
  details,
  effectiveExtra,
  extraAvailable,
  categoryFor,
  ordered,
} from '@/lib/manage-config';
import type { Resource } from '@/lib/settings';
export async function publicBusiness(id: string) {
  const b = await rawDb()
    .prepare('SELECT id,name,email,phone,services FROM businesses WHERE id=?')
    .bind(id)
    .first<{
      id: string;
      name: string;
      email: string;
      phone: string;
      services: string;
    }>();
  if (!b) return null;
  const config = await configuration(id);
  const packages = (
    await rawDb()
      .prepare('SELECT id,service,settings FROM packages WHERE business_id=?')
      .bind(id)
      .all<{ id: string; service: string; settings: string }>()
  ).results.filter(
    (p) =>
      JSON.parse(b.services).includes(p.service) &&
      ['Public', 'public'].includes(
        JSON.parse(p.settings || '{}').status || 'Public',
      ),
  );
  return { ...b, ...config, publicPackageIds: packages.map((p) => p.id) };
}
export function publicGalleryRows(
  resources: Resource[],
  kind: string,
  packageIds: string[],
  category = '',
) {
  if (!['addons', 'backdrops', 'designs', 'staff'].includes(kind)) return [];
  return ordered(
    resources.filter(
      (r) =>
        r.kind === kind &&
        !r.archived &&
        (r.data.showGallery === true ||
          (['addons', 'backdrops', 'designs'].includes(kind) &&
            r.data.showGallery !== false)) &&
        extraAvailable(r, resources, packageIds) &&
        (!category || r.data.categoryId === category) &&
        categoryFor(r, resources)?.data.showGallery !== false,
    ),
  ).map((r) => {
    const e = effectiveExtra(r, resources),
      d = details(r);
    return {
      id: r.id,
      name: r.name,
      description: String(r.data.description || r.data.bio || ''),
      price:
        kind === 'staff' ? null : Math.round(Number(e.data.price || 0) * 100),
      images: d.images,
      videos: d.videos,
      category: String(categoryFor(r, resources)?.name || ''),
      categoryId: String(r.data.categoryId || ''),
      preset: r.kind === 'designs' ? String(r.data.preset || '') : '',
      tags:
        r.kind === 'designs'
          ? resources
              .filter(
                (t) =>
                  t.kind === 'design_tags' &&
                  !t.archived &&
                  t.data.categoryId === r.data.categoryId &&
                  designIds(r, 'tagIds').includes(t.id),
              )
              .map((t) => ({ id: t.id, name: t.name }))
          : [],
      pricingMethod: String(e.data.pricingMethod || 'Flat rate / per unit'),
    };
  });
}
export function publicExtra(
  r: Resource,
  resources: Resource[],
  packageId: string,
) {
  const e = effectiveExtra(r, resources),
    d = details(r);
  return {
    id: r.id,
    name: r.name,
    description: String(r.data.description || ''),
    price: Math.round(Number(e.data.price || 0) * 100),
    maxQuantity: Number(e.data.maxQuantity || 1),
    pricingMethod: String(e.data.pricingMethod || 'Flat rate / per unit'),
    leadDays: Number(e.data.leadDays || 0),
    images: d.images,
    included: d.includedPackageIds.includes(packageId),
    category: String(categoryFor(r, resources)?.name || ''),
  };
}
