import { rawDb } from '@/db/raw';
import { proposalAccess } from '@/db/proposals';
import { proposalClientData, proposalDigest } from '@/db/proposal-options';
import { proposalSummary, type ProposalSelections } from '@/lib/proposal';
import { calculateQuote } from '@/lib/quote';
import { adjustedItems } from '@/lib/manage-pricing';
import { resolveProposalDiscount } from '@/lib/proposal-discounts';
import { checkDiscount, discountGuard } from '@/db/manage-guards';
const result = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function POST(req: Request) {
  try {
    if (
      req.headers.get('origin') !== new URL(req.url).origin ||
      req.headers.get('sec-fetch-site') === 'cross-site'
    )
      return result({ error: 'Invalid origin.' }, 403);
    const text = await req.text();
    if (text.length > 32000)
      return result({ error: 'Too many selections.' }, 413);
    const b = JSON.parse(text);
    const access = await proposalAccess(
      String(b.eventId || ''),
      String(b.token || ''),
    );
    if (!access) return result({ error: 'Proposal not found.' }, 404);
    const { client, config, packages, media } = await proposalClientData(
      access,
      String(b.token || ''),
    );
    if (!client.editable) return result({ error: client.editReason }, 409);
    if (b.revision !== client.revision)
      return result(
        {
          error:
            'This proposal changed. Reload the page and review your selections again.',
        },
        409,
      );
    if (!['quote', 'save'].includes(b.action)) throw Error('Unknown action.');
    const input = b.selections;
    if (
      !input ||
      !Array.isArray(input.addonIds) ||
      input.addonIds.length > 30 ||
      typeof input.backdropId !== 'string'
    )
      throw Error('Invalid selections.');
    const included = access.event.items.flatMap(
      (p) => p.packageSettings?.includedAddonIds || [],
    );
    const selections: ProposalSelections = {
      addonIds: [...new Set<string>([...input.addonIds, ...included])],
      backdropId: input.backdropId,
      addonQuantities: {},
      extraPackageIds: {},
    };
    for (const [id, kind] of [
      ...selections.addonIds.map((id) => [id, 'addons']),
      ...(selections.backdropId ? [[selections.backdropId, 'backdrops']] : []),
    ]) {
      const option = client.options.find((o) => o.id === id && o.kind === kind);
      if (!option)
        throw Error(
          'A selected option is no longer available. Reload the page to see the latest choices.',
        );
      const parent =
        input.extraPackageIds?.[id] ||
        client.selections.extraPackageIds[id] ||
        option.packages[0]?.id;
      if (!option.packages.some((p) => p.id === parent))
        throw Error('This option is not available for the selected package.');
      const quantity =
        kind === 'addons' ? (input.addonQuantities?.[id] ?? 1) : 1;
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > option.maxQuantity
      )
        throw Error('Enter a valid quantity for ' + option.name + '.');
      if (option.fixedQuantity && quantity !== option.fixedQuantity)
        throw Error(
          'Contact the business to change the quantity of ' + option.name + '.',
        );
      selections.addonQuantities[id] = quantity;
      selections.extraPackageIds[id] = parent;
    }
    const e = access.event,
      previous = e.operations?.quote;
    const discount = resolveProposalDiscount(input.discountCode, previous, config.resources);
    if (!client.showDiscountCode && discount.id !== (previous?.discountId || ''))
      return result({ error: 'Discount code changes are disabled for this proposal.' }, 403);
    if (discount.newRule) await checkDiscount(access.bid, e.id, discount.id);
    const quote = calculateQuote(
      e.items,
      config.resources,
      config.settings,
      {
        ...selections,
        date: e.date,
        time: e.time,
        discountId: discount.id,
        miles: previous?.miles,
      },
      previous,
    );
    if (quote.total < client.summary.paid)
      throw Error(
        'The updated total would be less than payments already collected. Contact the business.',
      );
    const items = adjustedItems(e.items, quote.extras),
      deposit = Math.min(e.deposit, quote.total);
    const summary = proposalSummary(
      {
        ...e,
        items,
        total: quote.total,
        deposit,
        operations: { ...e.operations, quote },
      },
      access.payments,
      packages,
      media,
    );
    const reviewToken = await proposalDigest([
      client.revision,
      quote,
      items,
      deposit,
    ]);
    if (b.action === 'quote') return result({ summary, reviewToken });
    if (b.reviewToken !== reviewToken)
      return result(
        {
          error:
            'Prices or selections changed. Review the updated total before saving.',
        },
        409,
      );
    const db = rawDb(),
      nonce = crypto.randomUUID(),
      now = new Date().toISOString();
    const ops = JSON.stringify({
      ...e.operations,
      quote,
      clientSelection: nonce,
    });
    const changes = await db.batch([
      ...(discount.newRule ? [discountGuard(access.bid, e.id, discount.id)] : []),
      db
        .prepare(`INSERT INTO event_operations(event_id,business_id,data)
        SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND business_id=? AND updated_at=? AND status='proposal' AND lifecycle='Active')
        AND COALESCE((SELECT ed_json(data) FROM event_operations WHERE event_id=? AND business_id=?),'{}')=ed_json(?)
        AND COALESCE((SELECT SUM(amount) FROM payments WHERE event_id=? AND business_id=? AND voided_at=''),0)=?
        AND (?=1 OR EXISTS(SELECT 1 FROM sales_records WHERE id=? AND business_id=? AND kind='proposal_link' AND archived=0 AND ed_text(data,'$.token')=?))
        AND (?='' OR EXISTS(SELECT 1 FROM resources WHERE id=? AND business_id=? AND kind='discounts' AND archived=0 AND ed_json(data)=ed_json(?)))
        ON CONFLICT(event_id) DO UPDATE SET data=excluded.data WHERE event_operations.business_id=excluded.business_id`)
        .bind(
          e.id,
          access.bid,
          ops,
          e.id,
          access.bid,
          e.updated_at,
          e.id,
          access.bid,
          JSON.stringify(e.operations || {}),
          e.id,
          access.bid,
          client.summary.paid,
          access.owner ? 1 : 0,
          'proposal-link:' + e.id,
          access.bid,
          String(b.token || ''),
          discount.newRule?.id || '',
          discount.newRule?.id || '',
          access.bid,
          JSON.stringify(discount.newRule?.data || {}),
        ),
      db
        .prepare(
          `UPDATE events SET items=?,total=?,deposit=?,updated_at=? WHERE id=? AND business_id=? AND EXISTS(SELECT 1 FROM event_operations WHERE event_id=? AND business_id=? AND ed_text(data,'$.clientSelection')=?)`,
        )
        .bind(
          JSON.stringify(items),
          quote.total,
          deposit,
          now,
          e.id,
          access.bid,
          e.id,
          access.bid,
          nonce,
        ),
    ]);
    if (!changes.slice(-2).every((r) => r.meta.changes === 1))
      return result(
        {
          error: 'This proposal changed. Reload the page before trying again.',
        },
        409,
      );
    const fresh = await proposalAccess(e.id, String(b.token || ''));
    if (!fresh)
      return result({ error: 'This proposal is no longer available.' }, 409);
    return result({
      client: (await proposalClientData(fresh, String(b.token || ''))).client,
    });
  } catch (error) {
    return result(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update selections.',
      },
      400,
    );
  }
}
