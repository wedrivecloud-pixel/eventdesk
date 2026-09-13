import type { Resource, Settings } from './settings';

export type Brand = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  color: string;
  logoId: string;
  signature: string;
  footer: string;
  headline: string;
  subheading: string;
  packageMode: 'all' | 'selected';
  packageIds: string[];
};
export const brandSocialNetworks = [
  {
    key: 'facebookUrl',
    label: 'Facebook',
    placeholder: 'https://www.facebook.com/yourbrand',
  },
  {
    key: 'instagramUrl',
    label: 'Instagram',
    placeholder: 'https://www.instagram.com/yourbrand',
  },
  {
    key: 'youtubeUrl',
    label: 'YouTube',
    placeholder: 'https://www.youtube.com/@yourbrand',
  },
  {
    key: 'tiktokUrl',
    label: 'TikTok',
    placeholder: 'https://www.tiktok.com/@yourbrand',
  },
] as const;
type SocialKey = (typeof brandSocialNetworks)[number]['key'];
export type BrandSocialLink = { label: string; url: string };
function socialUrl(value: unknown): string {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 500)
    throw Error('Invalid URL');
  const trimmed = value.trim();
  if (!trimmed) return '';
  const url = new URL(trimmed);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw Error('Invalid URL');
  return url.href;
}
export function checkedBrandSocials(data: Record<string, unknown>) {
  const result = {} as Record<SocialKey, string>;
  for (const { key, label } of brandSocialNetworks) {
    try {
      result[key] = socialUrl(data[key]);
    } catch {
      throw Error(
        label +
          ' must be a full https:// URL, up to 500 characters, without a username or password.',
      );
    }
  }
  return result;
}
export function brandSocialLinks(
  brand?: Pick<Brand, SocialKey>,
): BrandSocialLink[] {
  if (!brand) return [];
  return brandSocialNetworks.flatMap(({ key, label }) => {
    // Do not render unsafe links from legacy or imported records.
    try {
      const url = socialUrl(brand[key]);
      return url ? [{ label, url }] : [];
    } catch {
      return [];
    }
  });
}
export function brandDetails(r: Resource): Brand {
  return { ...r.data, id: r.id, name: r.name } as unknown as Brand;
}
export function brandRecords(resources: Resource[], includeArchived = false) {
  return resources.filter(
    (r) => r.kind === 'brands' && (includeArchived || !r.archived),
  );
}
export function findBrand(resources: Resource[], id = ''): Brand | undefined {
  if (!id) return undefined;
  const row = brandRecords(resources).find((r) => r.id === id);
  if (!row) throw Error('This brand is unavailable. Choose an active brand.');
  return brandDetails(row);
}
export function brandHasPackage(brand: Brand | undefined, id: string) {
  return !brand || brand.packageMode === 'all' || brand.packageIds.includes(id);
}
export function brandSettings(settings: Settings, brand?: Brand): Settings {
  return brand
    ? {
        ...settings,
        color: brand.color,
        address: brand.address,
        website: brand.website,
        signature: brand.signature,
        footer: brand.footer,
        headline: brand.headline,
        subheading: brand.subheading,
        logoVersion: brand.logoId,
      }
    : settings;
}
export function brandBookingPath(businessId: string, brandId = '') {
  return (
    '/reservation/start?' +
    new URLSearchParams({
      business: businessId,
      ...(brandId ? { brand: brandId } : {}),
    })
  );
}
export function brandLogoPath(businessId: string, brandId: string) {
  return (
    '/api/brand-logo?' +
    new URLSearchParams({ business: businessId, brand: brandId })
  );
}
