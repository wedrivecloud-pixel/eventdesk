import type { LineItem } from './crm';
import type { Resource, Settings } from './settings';
import {
  appliesTo,
  details,
  effectiveExtra,
  extraAvailable,
  ordered,
} from './manage-config';
export type PricingContext = {
  date: string;
  time?: string;
  bookingDate?: string;
  venueCity?: string;
  venueState?: string;
  venuePostalCode?: string;
  venueId?: string;
  setupLocation?: string;
  stairs?: string;
  userId?: string;
};
export type PricedExtra = {
  id: string;
  name: string;
  price: number;
  kind: string;
  basePrice?: number;
  included?: boolean;
  quantity?: number;
  unitPrice?: number;
  packageId?: string;
  extensionMinutes?: number;
  snapshot?: Resource;
};
export const localToday = (s: Settings) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: String(s.timezone || 'America/Los_Angeles'),
  }).format(new Date());
export function priceExtra(
  r: Resource,
  catalog: Resource[],
  items: LineItem[],
  quantity: unknown,
  context: PricingContext,
  includedIds: string[],
  packageId?: string,
  previous?: PricedExtra,
): PricedExtra {
  const effective = previous?.snapshot || effectiveExtra(r, catalog),
    d = details(effective),
    ids = items.map((p) => p.id);
  const qty = quantity ?? previous?.quantity ?? 1;
  if (
    typeof qty !== 'number' ||
    !Number.isSafeInteger(qty) ||
    qty < 1 ||
    qty > Number(effective.data.maxQuantity ?? 1)
  )
    throw Error(
      `${r.name}: choose a quantity between 1 and ${effective.data.maxQuantity ?? 1}.`,
    );
  if (
    packageId &&
    !items.some((p) => p.id === packageId && appliesTo(effective, [p.id]))
  )
    throw Error('Choose an eligible package for ' + r.name + '.');
  const p =
    items.find(
      (p) =>
        p.id === (packageId || previous?.packageId) &&
        appliesTo(effective, [p.id]),
    ) || items.find((p) => appliesTo(effective, [p.id]));
  if (!p || (!previous?.snapshot && !extraAvailable(r, catalog, ids)))
    throw Error(`${r.name} is not offered with these packages.`);
  if (
    !previous?.snapshot &&
    Number(effective.data.leadDays) > 0 &&
    context.bookingDate
  ) {
    const earliest = new Date(context.bookingDate + 'T12:00:00Z');
    earliest.setUTCDate(
      earliest.getUTCDate() + Number(effective.data.leadDays),
    );
    if (context.date < earliest.toISOString().slice(0, 10))
      throw Error(
        `${r.name} requires ${effective.data.leadDays} days of lead time.`,
      );
  }
  const minutes = p.minutes || p.packageSettings?.includedMinutes || 240;
  const multiplier =
    effective.data.pricingMethod === 'Multiply by package hours'
      ? minutes / 60
      : effective.data.pricingMethod === 'Multiply by package days'
        ? Math.ceil(minutes / 1440)
        : 1;
  const unitPrice = Math.round(
    Number(effective.data.price || 0) * 100 * multiplier,
  );
  const included =
    includedIds.includes(r.id) || d.includedPackageIds.includes(p.id);
  const basePrice = unitPrice * qty,
    price = unitPrice * Math.max(0, qty - (included ? 1 : 0)),
    extensionMinutes = Number(effective.data.extensionMinutes || 0) * qty;
  if (
    !Number.isSafeInteger(price) ||
    price < 0 ||
    price > 100000000 ||
    extensionMinutes > 10080
  )
    throw Error(
      'The add-on price or booking extension exceeds the supported range.',
    );
  return {
    id: r.id,
    name: effective.name,
    kind: r.kind,
    price,
    basePrice,
    unitPrice,
    included,
    quantity: qty,
    packageId: p.id,
    extensionMinutes,
    snapshot: effective,
  };
}
export function adjustedItems(items: LineItem[], extras: PricedExtra[]) {
  return items.map((p) => ({
    ...p,
    extraMinutes: extras
      .filter((x) => x.packageId === p.id)
      .reduce((s, x) => s + (x.extensionMinutes || 0), 0),
  }));
}
export function ruleMatches(
  r: Resource,
  items: LineItem[],
  subtotal: number,
  c: PricingContext,
) {
  const d = details(r),
    day = new Date(c.date + 'T12:00:00Z').getUTCDay(),
    book = c.bookingDate || new Date().toISOString().slice(0, 10);
  if (
    !appliesTo(
      r,
      items.map((p) => p.id),
    ) ||
    !d.days.includes(day)
  )
    return false;
  if (
    (r.data.starts && c.date < String(r.data.starts)) ||
    (r.data.ends && c.date > String(r.data.ends)) ||
    (r.data.bookStarts && book < String(r.data.bookStarts)) ||
    (r.data.bookEnds && book > String(r.data.bookEnds))
  )
    return false;
  const days = Math.floor(
    (Date.parse(c.date + 'T12:00:00Z') - Date.parse(book + 'T12:00:00Z')) /
      86400000,
  );
  if (
    (Number(r.data.withinDays) > 0 && days > Number(r.data.withinDays)) ||
    (Number(r.data.moreThanDays) > 0 && days <= Number(r.data.moreThanDays))
  )
    return false;
  if (
    (Number(r.data.minimumSubtotal) > 0 &&
      subtotal < Number(r.data.minimumSubtotal) * 100) ||
    (Number(r.data.maximumSubtotal) > 0 &&
      subtotal > Number(r.data.maximumSubtotal) * 100)
  )
    return false;
  const location = String(r.data.locationType || 'Any'),
    actual =
      location === 'City'
        ? c.venueCity
        : location === 'State / province'
          ? c.venueState
          : location === 'Postal code'
            ? c.venuePostalCode
            : c.venueId;
  if (
    location !== 'Any' &&
    !String(r.data.locationValues || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .includes((actual || '').toLowerCase())
  )
    return false;
  if (
    r.data.setupLocation &&
    r.data.setupLocation !== 'Any' &&
    r.data.setupLocation !== c.setupLocation
  )
    return false;
  if (r.data.stairs && r.data.stairs !== 'Any' && r.data.stairs !== c.stairs)
    return false;
  if (r.data.endTimeStart || r.data.endTimeEnd) {
    if (!c.time) return false;
    const [h, m] = c.time.split(':').map(Number),
      minutes = Math.max(
        ...items.map((p) => (p.minutes || 240) + (p.extraMinutes || 0)),
        0,
      ),
      end = (h * 60 + m + minutes) % 1440,
      toMinutes = (v: unknown) =>
        String(v)
          .split(':')
          .map(Number)
          .reduce((a, n, i) => a + n * (i === 0 ? 60 : 1), 0),
      start = toMinutes(r.data.endTimeStart || '00:00'),
      finish = toMinutes(r.data.endTimeEnd || '23:59');
    if (
      start <= finish
        ? end < start || end > finish
        : end < start && end > finish
    )
      return false;
  }
  return true;
}
export function scopedAmount(
  r: Resource,
  items: LineItem[],
  extras: PricedExtra[],
  subtotal: number,
  amount: number,
  percentage: boolean,
) {
  if (r.data.scope === 'Complete booking')
    return Math.round(percentage ? (subtotal * amount) / 100 : amount * 100);
  const eligible = items.filter((p) => appliesTo(r, [p.id]));
  const values =
    r.data.scope === 'Each specific item'
      ? eligible.map((p) => p.price)
      : eligible.map(
          (p) =>
            p.price +
            extras
              .filter((x) => x.packageId === p.id)
              .reduce((s, x) => s + x.price, 0),
        );
  return values.reduce(
    (sum, value) =>
      sum + Math.round(percentage ? (value * amount) / 100 : amount * 100),
    0,
  );
}
export function travelFromZones(
  catalog: Resource[],
  items: LineItem[],
  miles: number,
) {
  const zones = ordered(
    catalog.filter(
      (r) =>
        r.kind === 'travel_zones' &&
        !r.archived &&
        appliesTo(
          r,
          items.map((p) => p.id),
        ),
    ),
  );
  for (const r of zones) {
    const distance = miles * (r.data.unit === 'km' ? 1.609344 : 1);
    if (
      distance < Number(r.data.minimumDistance || 0) ||
      (Number(r.data.maximumDistance) > 0 &&
        distance > Number(r.data.maximumDistance))
    )
      continue;
    return {
      rule: r,
      amount: Math.round(
        (r.data.feeType === 'No fee'
          ? 0
          : r.data.feeType === 'Flat fee'
            ? Number(r.data.price)
            : Math.max(0, distance - Number(r.data.freeDistance || 0)) *
              Number(r.data.price) *
              (r.data.roundTrip ? 2 : 1)) * 100,
      ),
    };
  }
  return null;
}
