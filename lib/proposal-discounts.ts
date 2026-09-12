import type { Resource } from './settings';
import type { Quote } from './quote';

export function proposalDiscountCode(quote?: Quote) {
  return String(quote?.discountName || quote?.discountRule?.data.code || '');
}

export function resolveProposalDiscount(
  code: unknown,
  previous: Quote | undefined,
  resources: Resource[],
): { id: string; newRule?: Resource } {
  // Older clients and unchanged selections retain the agreed discount snapshot.
  if (code === undefined) return { id: previous?.discountId || '' };
  if (typeof code !== 'string' || code.length > 80)
    throw Error('Enter a discount code of up to 80 characters.');
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { id: '' };
  if (
    previous?.discountId &&
    normalized === proposalDiscountCode(previous).trim().toUpperCase()
  )
    return { id: previous.discountId };
  const rule = resources.find(
    (resource) =>
      resource.kind === 'discounts' &&
      !resource.archived &&
      String(resource.data.code).trim().toUpperCase() === normalized &&
      resource.data.allowProposalRedemption === true,
  );
  if (!rule)
    throw Error('That discount code is not available for this proposal.');
  return { id: rule.id, newRule: rule };
}
