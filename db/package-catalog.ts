import { ordered, details } from '@/lib/manage-config';
import { durationRules, packageDurationLabel } from '@/lib/package-pricing';
import { rawDb } from './raw';
import { configuration } from './store';
import { packageSettings } from '@/lib/package-config';
import { managerGroups } from '@/lib/package-manager';
import type { Data, PackageRecord } from '@/lib/crm';
import { catalogPresentation } from '@/lib/catalog-presentation';
import { findBrand, brandHasPackage, brandLogoPath, brandSocialLinks } from '@/lib/brands';
export async function packageCatalog(
  businessId: string,
  scope: { service?: string; group?: string; brand?: string } = {},
) {
  const db = rawDb();
  const business = await db
    .prepare('SELECT id,name,email,phone,services FROM businesses WHERE id=?')
    .bind(businessId)
    .first<{
      id: string;
      name: string;
      email: string;
      phone: string;
      services: string;
    }>();
  if (!business) return null;
  let services = JSON.parse(business.services) as string[];
  if (scope.service !== undefined) {
    if (!services.includes(scope.service)) return null;
    services = [scope.service];
  }
  if (scope.group !== undefined && scope.service === undefined) return null;
  const [rows, images, config] = await Promise.all([
    db
      .prepare(
        'SELECT id,name,description,service,price,duration,settings FROM packages WHERE business_id=?',
      )
      .bind(business.id)
      .all<{
        id: string;
        name: string;
        description: string;
        service: string;
        price: number;
        duration: string;
        settings: string;
      }>(),
    db
      .prepare(
        'SELECT id,package_id,alt FROM package_images WHERE business_id=? ORDER BY is_primary DESC,created_at',
      )
      .bind(business.id)
      .all<{ id: string; package_id: string; alt: string }>(),
    configuration(business.id),
  ]);
  let brand;
  try { brand = findBrand(config.resources, scope.brand); } catch { return null; }
  if (
    scope.group !== undefined &&
    !config.resources.some(
      (r) =>
        r.kind === 'package_groups' &&
        !r.archived &&
        r.data.service === scope.service &&
        r.name === scope.group,
    ) &&
    !rows.results.some(
      (p) =>
        p.service === scope.service &&
        (JSON.parse(p.settings).group || '') === scope.group,
    )
  )
    return null;
  const packages: PackageRecord[] = rows.results
    .map((p) => ({
      ...p,
      settings: packageSettings(JSON.parse(p.settings), p.duration),
    }))
    .filter(
      (p) =>
        p.settings.status === 'Public' && brandHasPackage(brand, p.id) &&
        services.includes(p.service) &&
        (scope.group === undefined || (p.settings.group || '') === scope.group),
    );
  const data = { packages, resources: config.resources } as Data;
  const groups = services.flatMap((service) =>
    managerGroups(data, service)
      .filter((g) => g.packages.length)
      .map((g) => ({
        service,
        name: g.name,
        presentation: catalogPresentation(g.record?.data),
        image: g.record?.data.imageId
          ? '/api/catalog-image?id=' + encodeURIComponent(g.record.id)
          : '',
        packages: g.packages.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          subheader: p.settings!.subheader,
          showTitle: p.settings!.showTitle,
          includedMinutes: durationRules(p.settings!).included,
          durationLabel: packageDurationLabel(p.settings!),
          unitCalculation: p.settings!.unitCalculation,
          extraDays:
            durationRules(p.settings!).dayBased && p.settings!.extraDays,
          dailyRate: p.settings!.dailyRate,
          extraHours:
            !durationRules(p.settings!).dayBased && p.settings!.extraHours,
          extraRate: p.settings!.extraRate,
          unitMode: p.settings!.unitMode,
          unitLabel: p.settings!.unitLabel,
          image: images.results.find((x) => x.package_id === p.id),
        })),
      })),
  );
  const first = groups[0]?.packages[0];
  const preset = ordered(
    config.resources.filter(
      (r) =>
        r.kind === 'booking_presets' &&
        !r.archived &&
        details(r).packageMode === 'all',
    ),
  )[0];
  return {
    cta: String(preset?.data.cta || config.settings.cta || 'Choose Now'),
    layout: String(preset?.data.layout || 'Cards'),
    background: String(preset?.data.background || ''),
    business: {
      id: business.id,
      name: brand?.name ?? business.name,
      email: brand?.email ?? business.email,
      phone: brand?.phone ?? business.phone,
      socialLinks: brandSocialLinks(brand),
    },
    brandId: brand?.id || '',
    headline: brand ? brand.headline : String(preset?.data.headline || config.settings.headline),
    subheading: brand ? brand.subheading : String(preset?.data.subheading || config.settings.subheading),
    color: brand ? brand.color : String(preset?.data.color || config.settings.color),
    logo:
      brand ? (brand.logoId ? brandLogoPath(business.id,brand.id) : '') : config.settings.logoVersion && first
        ? '/api/booking/image?' +
          new URLSearchParams({ package: first.id, logo: '1' })
        : '',
    groups,
    servicePresentation: Object.fromEntries(
      services.map((service) => {
        const r = config.resources.find(
          (r) =>
            r.kind === 'service_settings' && !r.archived && r.name === service,
        );
        return [
          service,
          {
            ...catalogPresentation(r?.data),
            image: r?.data.imageId
              ? '/api/catalog-image?id=' + encodeURIComponent(r.id)
              : '',
          },
        ];
      }),
    ),
  };
}
