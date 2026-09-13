import type { LineItem } from './crm';
import type { Resource, Settings } from './settings';
import { calculateQuote, type Quote } from './quote';

type ExtrasInput = {
  date: string;
  time?: string;
  addonIds?: string[];
  addonQuantities?: Record<string, number>;
  extraPackageIds?: Record<string, string>;
  backdropId?: string;
};

// Confirmed bookings keep their agreed package prices and pricing rules.
// A contact-only edit must not recalculate a historical quote.
export function bookingExtrasQuote(
  items: LineItem[],
  catalog: Resource[],
  settings: Settings,
  input: ExtrasInput,
  previous?: Quote,
): Quote {
  const addonIds = input.addonIds ?? previous?.addonIds ?? [];
  if (
    !Array.isArray(addonIds) ||
    addonIds.length > 30 ||
    addonIds.some((id) => typeof id !== 'string' || !id)
  )
    throw Error('Choose up to 30 valid add-ons.');
  const ids = [
    ...new Set([
      ...addonIds,
      ...items.flatMap((p) => p.packageSettings?.includedAddonIds || []),
    ]),
  ];
  const quantities = input.addonQuantities ?? previous?.addonQuantities ?? {};
  const parents = input.extraPackageIds ?? previous?.extraPackageIds ?? {};
  for (const values of [quantities, parents])
    if (
      !values ||
      typeof values !== 'object' ||
      Array.isArray(values) ||
      Object.keys(values).length > 100
    )
      throw Error('Invalid add-on options.');
  const backdropId = input.backdropId ?? previous?.backdropId ?? '';
  if (typeof backdropId !== 'string') throw Error('Choose a valid backdrop.');
  const oldIds = previous?.addonIds || [];
  const same =
    previous &&
    ids.length === oldIds.length &&
    ids.every(
      (id) =>
        oldIds.includes(id) &&
        (quantities[id] ?? 1) === (previous.addonQuantities?.[id] ?? 1) &&
        (parents[id] || previous.extraPackageIds?.[id] || '') ===
          (previous.extraPackageIds?.[id] || ''),
    ) &&
    backdropId === previous.backdropId;
  if (same) return previous;
  const quote = calculateQuote(
    items,
    catalog,
    settings,
    {
      ...input,
      addonIds: ids,
      addonQuantities: quantities,
      extraPackageIds: parents,
      backdropId,
      context: previous?.context,
      discountId: previous?.discountId,
      miles: previous?.miles,
    },
    previous,
  );
  return previous ? { ...quote, dueDate: previous.dueDate } : quote;
}
