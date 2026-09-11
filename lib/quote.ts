import type { Settings, Resource } from './settings';
import { mergedSettings } from './settings';
import type { LineItem } from './crm';
import { details, appliesTo, ordered } from './manage-config';
import {
  priceExtra,
  ruleMatches,
  scopedAmount,
  travelFromZones,
  localToday,
  type PricedExtra,
  type PricingContext,
} from './manage-pricing';
export type Quote = {
  presentation?: {
    theme: string;
    pricingTitle: string;
    images: string[];
    reviews: { reviewer: string; body: string; rating: number }[];
    about: string;
  };
  rules?: Resource[];
  discountRule?: Resource;
  subtotal: number;
  extras: PricedExtra[];
  addonQuantities?: Record<string, number>;
  extraPackageIds?: Record<string, string>;
  context?: PricingContext;
  travelRule?: Resource;
  travelRules?: Resource[];
  taxRules?: Resource[];
  adjustment: number;
  discount: number;
  discountName: string;
  tax: number;
  taxLabel: string;
  travel: number;
  total: number;
  depositDefault: number;
  dueDate: string;
  validUntil: string;
  terms: string;
  intro: string;
  settings: Settings;
  addonIds: string[];
  backdropId: string;
  discountId: string;
  miles: number;
};
export function calculateQuote(
  items: LineItem[],
  catalog: Resource[],
  preferences: Settings,
  input: {
    date: string;
    time?: string;
    context?: Partial<PricingContext>;
    addonQuantities?: Record<string, number>;
    extraPackageIds?: Record<string, string>;
    addonIds?: string[];
    backdropId?: string;
    discountId?: string;
    miles?: number;
  },
  previous?: Quote,
): Quote {
  for (const [label, values] of [
    ['Quantities', input.addonQuantities],
    ['Extra packages', input.extraPackageIds],
  ] as const) {
    if (
      values !== undefined &&
      (!values ||
        typeof values !== 'object' ||
        Array.isArray(values) ||
        Object.keys(values).length > 100)
    )
      throw Error('Invalid ' + label.toLowerCase() + '.');
  }
  if (input.context) {
    if (typeof input.context !== 'object' || Array.isArray(input.context))
      throw Error('Invalid venue pricing details.');
    for (const [key, value] of Object.entries(input.context))
      if (
        ![
          'date',
          'time',
          'bookingDate',
          'venueCity',
          'venueState',
          'venuePostalCode',
          'venueId',
          'setupLocation',
          'stairs',
          'userId',
        ].includes(key) ||
        typeof value !== 'string' ||
        value.length > 250
      )
        throw Error('Invalid venue pricing details.');
  }
  const s = mergedSettings(previous?.settings || preferences);
  const context: PricingContext = {
    ...previous?.context,
    ...input.context,
    date: input.date,
    time: input.time ?? previous?.context?.time,
    bookingDate: previous?.context?.bookingDate || localToday(s),
  };
  const included = [
    ...new Set(items.flatMap((p) => p.packageSettings?.includedAddonIds || [])),
  ];
  const addonIds = [...new Set([...(input.addonIds || []), ...included])];
  if (addonIds.length > 30) throw new Error('Choose up to 30 add-ons.');
  const extras: Quote['extras'] = [];
  for (const [id, kind] of [
    ...addonIds.map((id) => [id, 'addons']),
    ...(input.backdropId ? [[input.backdropId, 'backdrops']] : []),
  ]) {
    const old = previous?.extras.find((x) => x.id === id && x.kind === kind);
    if (old && !old.snapshot) {
      extras.push({
        ...old,
        basePrice: old.basePrice ?? old.price,
        included: included.includes(id),
        price: included.includes(id) ? 0 : (old.basePrice ?? old.price),
      });
      continue;
    }
    const r =
      old?.snapshot ||
      catalog.find((r) => r.id === id && r.kind === kind && !r.archived);
    if (!r) throw Error('An event extra is unavailable in this business.');
    extras.push(
      priceExtra(
        r,
        catalog,
        items,
        kind === 'addons' ? input.addonQuantities?.[id] : 1,
        context,
        included,
        input.extraPackageIds?.[id],
        old,
      ),
    );
  }
  const subtotal =
    items.reduce((s, p) => s + p.price, 0) +
    extras.reduce((s, p) => s + p.price, 0);
  const day = new Date(input.date + 'T12:00:00Z').getUTCDay();
  const names = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  let percent = 0,
    advancedAdjustment = 0;
  const rules =
    previous?.rules || catalog.filter((x) => x.kind === 'flex' && !x.archived);
  for (const r of rules) {
    if (r.data.details) {
      if (ruleMatches(r, items, subtotal, context))
        advancedAdjustment +=
          scopedAmount(
            r,
            items,
            extras,
            subtotal,
            Number(r.data.amount || 0),
            r.data.mode === 'Percentage',
          ) * (r.data.ruleType === 'Discount' ? -1 : 1);
      continue;
    }
    if (
      (r.data.starts && input.date < String(r.data.starts)) ||
      (r.data.ends && input.date > String(r.data.ends))
    )
      continue;
    const match =
      r.data.day === 'Every day' ||
      r.data.day === names[day] ||
      (r.data.day === 'Weekends' && [0, 6].includes(day)) ||
      (r.data.day === 'Weekdays' && day > 0 && day < 6);
    if (match) percent += Number(r.data.percent || 0);
  }
  const adjustment = Math.max(
    -subtotal,
    Math.round((subtotal * Math.max(-100, percent)) / 100) + advancedAdjustment,
  );
  let discount = 0,
    discountName = '';
  let discountRule: Resource | undefined;
  if (input.discountId) {
    const d =
      previous?.discountId === input.discountId && previous?.discountRule
        ? previous.discountRule
        : catalog.find(
            (r) =>
              r.id === input.discountId &&
              r.kind === 'discounts' &&
              !r.archived,
          );
    discountRule = d;
    if (!d) throw new Error('Discount is unavailable.');
    const validDate =
      d.data.dateBasis === 'Booking date' ? context.bookingDate! : input.date;
    if (
      (d.data.starts && validDate < String(d.data.starts)) ||
      (d.data.expires && validDate > String(d.data.expires))
    )
      throw Error('This discount is outside its valid date range.');
    if (
      d.data.details &&
      (!details(d).days.includes(day) ||
        !appliesTo(
          d,
          items.map((p) => p.id),
        ))
    )
      throw Error(
        'This discount does not apply to these packages or this weekday.',
      );
    discountName = String(d.data.code);
    const amount = d.data.details
      ? scopedAmount(
          d,
          items,
          extras,
          subtotal + adjustment,
          Number(d.data.amount),
          d.data.mode === 'Percentage',
        )
      : Math.round(
          d.data.mode === 'Percentage'
            ? ((subtotal + adjustment) * Number(d.data.amount)) / 100
            : Number(d.data.amount) * 100,
        );
    discount = Math.min(subtotal + adjustment, Math.max(0, amount));
  }
  const net = subtotal + adjustment - discount;
  const taxableSubtotal =
    items.reduce(
      (sum, p) => sum + (p.packageSettings?.taxable === false ? 0 : p.price),
      0,
    ) +
    extras.reduce(
      (sum, x) => sum + (x.snapshot?.data.taxable === false ? 0 : x.price),
      0,
    );
  const taxableNet =
    subtotal > 0 ? Math.round((net * taxableSubtotal) / subtotal) : 0;
  const taxRules =
    previous?.taxRules ||
    catalog.filter((r) => r.kind === 'tax_zones' && !r.archived);
  const matchedTax = taxRules.filter(
    (r) =>
      !r.data.states ||
      String(r.data.states)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .includes((context.venueState || '').toLowerCase()),
  );
  const tax = Math.round(
    (taxableNet *
      (matchedTax.length
        ? matchedTax.reduce((n, r) => n + Number(r.data.rate || 0), 0)
        : Number(s.taxRate))) /
      100,
  );
  const miles = input.miles || 0;
  if (!Number.isFinite(miles) || miles < 0 || miles > 10000)
    throw new Error('Enter a distance between 0 and 10,000 miles.');
  const travelRules =
    previous?.travelRules ||
    (previous?.travelRule
      ? [previous.travelRule]
      : previous
        ? []
        : catalog.filter((r) => r.kind === 'travel_zones' && !r.archived));
  const zone = travelFromZones(travelRules, items, miles);
  const travel =
    zone?.amount ??
    Math.round(
      (Number(s.travelBase) +
        Math.max(0, miles - Number(s.freeMiles)) * Number(s.mileRate)) *
        100,
    );
  const total = net + tax + travel;
  if (!Number.isSafeInteger(total) || total < 0 || total > 100000000)
    throw new Error('Quote total must be between $0 and $1,000,000.');
  let depositDefault = Math.min(
    total,
    Math.round(
      s.depositMode === 'Percentage'
        ? (total * Number(s.depositValue)) / 100
        : s.depositMode === 'Fixed amount'
          ? Number(s.depositValue) * 100
          : 0,
    ),
  );
  const overrides = items.filter(
    (p) =>
      p.packageSettings && p.packageSettings.depositMode !== 'Business default',
  );
  if (overrides.length) {
    const itemTotal = items.reduce((n, p) => n + p.price, 0);
    const overrideTotal = overrides.reduce((n, p) => n + p.price, 0);
    // Snapshot basis preserves historical quotes. New percentage deposits cover
    // this package's proportional share of the final booking total.
    depositDefault = Math.min(
      total,
      Math.round(
        depositDefault *
          (itemTotal ? Math.max(0, 1 - overrideTotal / itemTotal) : 0) +
          overrides.reduce((n, p) => {
            const s = p.packageSettings!;
            return (
              n +
              (s.depositMode === 'Flat rate'
                ? s.depositValue * 100
                : s.depositMode === 'Percentage'
                  ? ((s.depositBasis === 'Booking total share'
                      ? total *
                        (itemTotal ? p.price / itemTotal : 1 / items.length)
                      : p.price) *
                      s.depositValue) /
                    100
                  : 0)
            );
          }, 0),
      ),
    );
  }
  const due = new Date(input.date + 'T12:00:00Z');
  due.setUTCDate(
    due.getUTCDate() +
      Number(s.dueDays) * (s.dueTiming === 'After event' ? 1 : -1),
  );
  const valid = new Date();
  valid.setUTCDate(valid.getUTCDate() + Number(s.validDays));
  const preset = ordered(
    catalog.filter(
      (r) =>
        r.kind === 'proposal_presets' &&
        !r.archived &&
        appliesTo(
          r,
          items.map((p) => p.id),
        ),
    ),
  )[0];
  const presentation = previous?.presentation || {
    theme: String(preset?.data.theme || 'Classic'),
    pricingTitle: String(preset?.data.pricingTitle || 'Pricing'),
    images: details(preset).images.slice(
      0,
      Number(preset?.data.maxPhotos ?? 18),
    ),
    reviews: ordered(
      catalog.filter(
        (r) =>
          r.kind === 'reviews' &&
          !r.archived &&
          r.data.published &&
          appliesTo(
            r,
            items.map((p) => p.id),
          ),
      ),
    )
      .slice(0, Number(preset?.data.maxReviews ?? 5))
      .map((r) => ({
        reviewer: String(r.data.reviewer || r.name),
        body: String(r.data.body || ''),
        rating: Number(r.data.rating || 5),
      })),
    about: String(s.about || ''),
  };
  return {
    presentation,
    rules,
    context,
    addonQuantities: Object.fromEntries(
      extras
        .filter((x) => x.kind === 'addons')
        .map((x) => [x.id, x.quantity || 1]),
    ),
    extraPackageIds: Object.fromEntries(
      extras.filter((x) => x.packageId).map((x) => [x.id, x.packageId!]),
    ),
    travelRule: zone?.rule,
    travelRules,
    taxRules,
    discountRule,
    subtotal,
    extras,
    adjustment,
    discount,
    discountName,
    tax,
    taxLabel: matchedTax.length
      ? matchedTax.map((r) => String(r.data.label || r.name)).join(' + ')
      : String(s.taxLabel),
    travel,
    total,
    depositDefault,
    dueDate: due.toISOString().slice(0, 10),
    validUntil: previous?.validUntil || valid.toISOString().slice(0, 10),
    terms: previous?.terms ?? String(s.proposalTerms),
    intro: previous?.intro ?? String(s.proposalIntro),
    settings: s,
    addonIds,
    backdropId: input.backdropId || '',
    discountId: input.discountId || '',
    miles,
  };
}
