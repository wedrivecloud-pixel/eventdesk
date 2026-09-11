import type { Resource } from './settings';

export type VenueSuggestion = {
  id: string;
  source: 'saved' | 'google';
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  streetAddress?: string;
  addressLine2?: string;
};

const clean = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';
const normalized = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function savedVenues(
  resources: Resource[],
  excludeId = '',
): VenueSuggestion[] {
  return resources
    .filter((r) => r.kind === 'venues' && !r.archived && r.id !== excludeId)
    .map((r) => ({
      id: r.id,
      source: 'saved' as const,
      name: r.name,
      address: clean(r.data.address),
      city: clean(r.data.city),
      state: clean(r.data.state),
      postalCode: clean(r.data.postalCode),
      country: clean(r.data.country),
    }));
}

export function matchVenues(venues: VenueSuggestion[], query: string) {
  const terms = normalized(query.trim()).split(/\s+/).filter(Boolean);
  return venues
    .filter((v) => {
      const haystack = normalized(
        [v.name, v.address, v.city, v.state, v.postalCode, v.country].join(' '),
      );
      return terms.every((t) => haystack.includes(t));
    })
    .slice(0, 8);
}

export function venueLocation(v: VenueSuggestion) {
  // Existing records sometimes have a full address in one field. Do not append
  // city/state/postal code a second time when those values are already present.
  let address = v.address;
  for (const part of v.source === 'google'
    ? []
    : [v.city, v.state, v.postalCode, v.country]) {
    const words = (text: string) =>
      ' ' +
      normalized(text)
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim() +
      ' ';
    if (part && !words(address).includes(words(part)))
      address += (address ? ', ' : '') + part;
  }
  if (!v.name || normalized(v.name) === normalized(address)) return address;
  return [v.name, address].filter(Boolean).join(' — ');
}

type GoogleAddress = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  postalAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  addressComponents?: {
    longText?: string;
    shortText?: string;
    types?: string[];
  }[];
};
export function googleVenue(input: GoogleAddress): VenueSuggestion {
  const components = input.addressComponents || [];
  const postal = input.postalAddress;
  const component = (type: string, short = false) => {
    const c = components.find((x) => x.types?.includes(type));
    return clean(short ? c?.shortText || c?.longText : c?.longText);
  };
  return {
    id: clean(input.id),
    source: 'google',
    name: clean(input.displayName?.text),
    address: clean(input.formattedAddress),
    streetAddress:
      clean(postal?.addressLines?.[0]) ||
      [component('street_number'), component('route')]
        .filter(Boolean)
        .join(' ') ||
      clean(input.formattedAddress),
    addressLine2: (postal?.addressLines || [])
      .slice(1)
      .map(clean)
      .filter(Boolean)
      .join(', '),
    city:
      component('locality') ||
      component('postal_town') ||
      component('sublocality_level_1') ||
      component('administrative_area_level_2') ||
      clean(postal?.locality),
    state:
      component('administrative_area_level_1', true) ||
      clean(postal?.administrativeArea),
    postalCode:
      [component('postal_code'), component('postal_code_suffix')]
        .filter(Boolean)
        .join('-') || clean(postal?.postalCode),
    country: component('country', true) || clean(postal?.regionCode),
  };
}
