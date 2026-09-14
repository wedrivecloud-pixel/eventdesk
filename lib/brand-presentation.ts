import type { Settings } from './settings';

export const trustIndicatorTypes = [
  'Events Hosted',
  'Years in Business',
  'Clients Served',
  'Photos Taken',
  'Hours of Entertainment',
  'Client Satisfaction',
  '5-Star Reviews',
  'Average Rating',
  'Repeat Customers',
  'Referral Rate',
  'Awards Won',
  'Team Members',
  'Google Reviews',
  'On-Time Rate',
  'Response Time',
] as const;
export type TrustIndicator = {
  type: (typeof trustIndicatorTypes)[number];
  value: string;
};
export type BrandPresentation = {
  about?: string;
  trustIndicators?: TrustIndicator[];
  showAddress?: boolean;
  overrideInvoice?: boolean;
  invoiceLogoId?: string;
  invoiceName?: string;
  invoiceAddress?: string;
  invoiceAddress2?: string;
  invoiceCity?: string;
  invoiceState?: string;
  invoicePostalCode?: string;
  invoiceEmail?: string;
  invoicePhone?: string;
  signature?: string;
  footer?: string;
};
export const invoiceContactFields = [
  ['invoiceName', 'Business name', 120],
  ['invoiceAddress', 'Address line 1', 300],
  ['invoiceAddress2', 'Address line 2', 300],
  ['invoiceCity', 'City', 120],
  ['invoiceState', 'State / province', 120],
  ['invoicePostalCode', 'ZIP / postal code', 30],
  ['invoiceEmail', 'Email address', 254],
  ['invoicePhone', 'Phone', 40],
] as const;
export function presentationFromSettings(s: Settings = {}): BrandPresentation {
  let trustIndicators: TrustIndicator[] = [];
  try {
    const parsed = JSON.parse(String(s.trustIndicators || '[]'));
    if (Array.isArray(parsed)) trustIndicators = parsed;
  } catch {
    /* Older settings have no indicators. */
  }
  return { ...s, trustIndicators } as BrandPresentation;
}
export function documentIdentity(
  business: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    website?: string;
  },
  details: BrandPresentation,
) {
  const alternate = details.overrideInvoice === true;
  const address = alternate
    ? [
        details.invoiceAddress,
        details.invoiceAddress2,
        [details.invoiceCity, details.invoiceState, details.invoicePostalCode]
          .filter(Boolean)
          .join(', '),
      ]
        .filter(Boolean)
        .join('\n')
    : business.address || '';
  return {
    ...business,
    name:
      alternate && details.invoiceName ? details.invoiceName : business.name,
    email:
      alternate && details.invoiceEmail ? details.invoiceEmail : business.email,
    phone:
      alternate && details.invoicePhone ? details.invoicePhone : business.phone,
    address: details.showAddress === false ? '' : address,
  };
}
export function documentBrandPresentation(details: BrandPresentation = {}) {
  return {
    about: typeof details.about === 'string' ? details.about : '',
    trustIndicators: (Array.isArray(details.trustIndicators)
      ? details.trustIndicators
      : []
    )
      .filter(
        (r) =>
          r &&
          trustIndicatorTypes.includes(r.type) &&
          typeof r.value === 'string' &&
          r.value.trim(),
      )
      .slice(0, 12)
      .map(({ type, value }) => ({ type, value })),
  };
}
