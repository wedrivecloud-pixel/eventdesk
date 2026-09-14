import { text, email } from '@/lib/crm';
import {
  trustIndicatorTypes,
  invoiceContactFields,
  type BrandPresentation,
  type TrustIndicator,
} from '@/lib/brand-presentation';
import type { Resource } from '@/lib/settings';

export function checkedBrandPresentation(
  d: Record<string, unknown>,
  resources: Resource[],
): BrandPresentation {
  const flag = (key: string, fallback: boolean) => {
    if (d[key] === undefined) return fallback;
    if (typeof d[key] !== 'boolean')
      throw Error('Choose a valid ' + key + ' option.');
    return d[key] as boolean;
  };
  const result: BrandPresentation = {
    about: text(d.about ?? '', 'About us', 10000, false),
    signature: text(d.signature ?? '', 'Signature', 3000, false),
    footer: text(d.footer ?? '', 'Document footer', 3000, false),
    showAddress: flag('showAddress', true),
    overrideInvoice: flag('overrideInvoice', false),
    invoiceLogoId: text(d.invoiceLogoId ?? '', 'Invoice logo', 100, false),
    trustIndicators: [],
  };
  for (const [key, label, max] of invoiceContactFields)
    result[key] = text(d[key] ?? '', label, max, false);
  if (result.invoiceEmail) result.invoiceEmail = email(result.invoiceEmail);
  if (
    result.invoiceLogoId &&
    !resources.some(
      (r) =>
        r.id === result.invoiceLogoId &&
        r.kind === 'media' &&
        !r.archived &&
        ['image/png', 'image/jpeg', 'image/webp'].includes(String(r.data.mime)),
    )
  )
    throw Error('Choose an invoice logo from your media library.');
  if (d.trustIndicators !== undefined) {
    if (!Array.isArray(d.trustIndicators) || d.trustIndicators.length > 12)
      throw Error('Add up to 12 trust indicators.');
    result.trustIndicators = d.trustIndicators.map((r: unknown) => {
      if (!r || typeof r !== 'object')
        throw Error('Choose a trust indicator and enter its value.');
      const row = r as Record<string, unknown>;
      if (!trustIndicatorTypes.includes(row.type as TrustIndicator['type']))
        throw Error('Choose a valid trust indicator.');
      return {
        type: row.type as TrustIndicator['type'],
        value: text(row.value, 'Trust indicator value', 60),
      };
    });
    if (
      new Set(result.trustIndicators.map((r) => r.type)).size !==
      result.trustIndicators.length
    )
      throw Error('Use each trust indicator only once.');
  }
  return result;
}
