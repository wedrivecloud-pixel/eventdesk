import { rawDb } from './raw';
import { configuration } from './store';
import { proposalAccess } from './proposals';
import {
  proposalSummary,
  type ProposalClientData,
  type ProposalOption,
  type ProposalSelections,
} from '@/lib/proposal';
import type { PackageRecord, PackageImage } from '@/lib/crm';
import {
  categoryFor,
  details,
  extraAvailable,
  ordered,
} from '@/lib/manage-config';
import { localToday, priceExtra } from '@/lib/manage-pricing';
import { proposalDiscountCode } from '@/lib/proposal-discounts';
export type ProposalAccess = NonNullable<
  Awaited<ReturnType<typeof proposalAccess>>
>;
export async function proposalDigest(value: unknown) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
export async function proposalClientData(access: ProposalAccess, token = '') {
  const { event: e, bid } = access,
    config = await configuration(bid);
  const ids = JSON.stringify(e.items.map((p) => p.id));
  const packages = (
    await rawDb()
      .prepare(
        'SELECT id,name,service,price,duration,description FROM packages WHERE business_id=? AND id IN (SELECT value FROM ed_each(?))',
      )
      .bind(bid, ids)
      .all<PackageRecord>()
  ).results;
  const images = (
    await rawDb()
      .prepare(
        'SELECT id,package_id,is_primary,alt FROM package_images WHERE business_id=? AND package_id IN (SELECT value FROM ed_each(?)) ORDER BY is_primary DESC,created_at',
      )
      .bind(bid, ids)
      .all<PackageImage>()
  ).results;
  for (const p of packages)
    p.images = images.filter((i) => i.package_id === p.id);
  const media =
    '/api/proposal/media?event=' +
    encodeURIComponent(e.id) +
    (token ? '&token=' + encodeURIComponent(token) : '');
  const quote = e.operations?.quote;
  const included = e.items.flatMap(
    (p) => p.packageSettings?.includedAddonIds || [],
  );
  const options: ProposalOption[] = [];
  const today = localToday(config.settings);
  const catalog = ordered(
    config.resources.filter((r) => ['addons', 'backdrops'].includes(r.kind)),
  );
  // Historical selections stay visible at their quoted price, even when archived.
  for (const x of quote?.extras || [])
    if (!catalog.some((r) => r.id === x.id))
      catalog.push(
        x.snapshot ||
          ({
            id: x.id,
            kind: x.kind,
            name: x.name,
            archived: 1,
            data: {},
            created_at: '',
            updated_at: '',
          } as (typeof catalog)[number]),
      );
  for (const r of catalog) {
    const old = quote?.extras.find((x) => x.id === r.id),
      source = old?.snapshot || r;
    const prices: ProposalOption['packages'] = [];
    for (const p of e.items) {
      if (old && !old.snapshot) {
        if (p.id === (old.packageId || e.items[0]?.id))
          prices.push({
            id: p.id,
            name: p.name,
            price: old.price,
            included: !!old.included,
          });
        continue;
      }
      if (!old && !extraAvailable(r, config.resources, [p.id])) continue;
      try {
        const priced = priceExtra(
          source,
          config.resources,
          [p],
          1,
          { ...quote?.context, date: e.date, time: e.time, bookingDate: today },
          included,
          p.id,
          old?.snapshot ? old : undefined,
        );
        prices.push({
          id: p.id,
          name: p.name,
          price: priced.unitPrice ?? priced.price,
          included: priced.included || false,
        });
      } catch {
        /* Ineligible packages and unmet lead times are not offered. */
      }
    }
    if (!prices.length) continue;
    const image = details(source).images[0];
    options.push({
      id: r.id,
      name: old?.name || source.name,
      kind: r.kind as ProposalOption['kind'],
      description: String(source.data.description || ''),
      category:
        categoryFor(r, config.resources)?.name ||
        (r.kind === 'backdrops' ? 'Backdrops' : 'Add-ons'),
      imageUrl: image
        ? media +
          '&extra=' +
          encodeURIComponent(r.id) +
          '&id=' +
          encodeURIComponent(image)
        : '',
      maxQuantity:
        old && !old.snapshot
          ? old.quantity || 1
          : Number(source.data.maxQuantity || 1),
      fixedQuantity: old && !old.snapshot ? old.quantity || 1 : undefined,
      locked: included.includes(r.id),
      packages: prices,
    });
  }
  const selections: ProposalSelections = {
    discountCode: proposalDiscountCode(quote),
    addonIds: [
      ...new Set([
        ...(quote?.addonIds ||
          quote?.extras.filter((x) => x.kind === 'addons').map((x) => x.id) ||
          []),
        ...included,
      ]),
    ],
    backdropId:
      quote?.backdropId ||
      quote?.extras.find((x) => x.kind === 'backdrops')?.id ||
      '',
    addonQuantities: Object.fromEntries(
      (quote?.extras || []).map((x) => [x.id, x.quantity || 1]),
    ),
    extraPackageIds: Object.fromEntries(
      (quote?.extras || []).map((x) => [
        x.id,
        x.packageId || e.items[0]?.id || '',
      ]),
    ),
  };
  const editReason =
    e.lifecycle && e.lifecycle !== 'Active'
      ? 'This proposal is no longer active.'
      : e.status !== 'proposal'
        ? 'Contact the business to change a confirmed booking.'
        : e.operations?.paymentPlan
          ? 'Contact the business to adjust selections covered by your payment plan.'
          : quote?.validUntil && quote.validUntil < today
            ? 'This proposal has expired. Contact the business to renew it.'
            : '';
  const client: ProposalClientData = {
    summary: proposalSummary(e, access.payments, packages, media),
    options,
    selections,
    revision: await proposalDigest([
      e.updated_at,
      quote || null,
      access.payments,
      e.operations?.showDiscountCode === true,
    ]),
    editable: !editReason,
    showDiscountCode: e.operations?.showDiscountCode === true,
    editReason,
  };
  return { client, config, packages, media };
}
