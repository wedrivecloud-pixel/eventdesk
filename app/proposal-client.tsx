'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ProposalDocument } from './proposal-document';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type {
  ProposalClientData,
  ProposalSelections,
  ProposalSummary,
  EventAttachment,
} from '@/lib/proposal';
import { money } from '@/lib/crm';
import { ProposalDiscountForm } from './proposal-discount-form';

export function ProposalClient({
  initial,
  business,
  attachments,
  token,
}: {
  initial: ProposalClientData;
  business: { name: string; email: string; phone: string };
  attachments: EventAttachment[];
  token: string;
}) {
  const [data, setData] = useState(initial),
    [picker, setPicker] = useState<{
      kind: 'addons' | 'backdrops';
      packageId: string;
    } | null>(null);
  const [draft, setDraft] = useState<ProposalSelections>(initial.selections),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('');
  const [review, setReview] = useState<{
      summary: ProposalSummary;
      reviewToken: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [discountError, setDiscountError] = useState('');
  function change(next: ProposalSelections) {
    setDraft(next);
    setReview(null);
    setError('');
  }
  async function requestOptions(
    action: 'quote' | 'save',
    selections: ProposalSelections,
    reviewToken?: string,
  ) {
    const response = await fetch('/api/proposal/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        eventId: data.summary.id,
        token,
        revision: data.revision,
        selections,
        reviewToken,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const value = (await response.json()) as {
      error?: string;
      summary: ProposalSummary;
      reviewToken: string;
      client: ProposalClientData;
    };
    if (!response.ok)
      throw Error(value.error || 'Unable to update your selections.');
    return value;
  }
  async function applyDiscount(code: string) {
    if (busy) return;
    setBusy(true);
    setDiscountError('');
    setNotice('');
    try {
      const selections = { ...data.selections, discountCode: code };
      const quote = await requestOptions('quote', selections);
      const saved = await requestOptions('save', selections, quote.reviewToken);
      setData(saved.client);
      setDraft(saved.client.selections);
      setReview(null);
      setNotice(
        code.trim()
          ? 'Discount applied. Your proposal total and balance have been updated.'
          : 'Discount removed. Your proposal total and balance have been updated.',
      );
    } catch (e) {
      setDiscountError(
        e instanceof Error ? e.message : 'Unable to apply this discount.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(action: 'quote' | 'save') {
    setBusy(true);
    setError('');
    try {
      const value = await requestOptions(action, draft, review?.reviewToken);
      if (action === 'quote') setReview(value);
      else {
        setData(value.client);
        setPicker(null);
        setNotice(
          'Your selections have been saved. The proposal remains open for business approval.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      if (action === 'save') setReview(null);
    } finally {
      setBusy(false);
    }
  }
  const options = picker
    ? data.options.filter(
        (o) =>
          o.kind === picker.kind &&
          o.packages.some((p) => p.id === picker.packageId),
      )
    : [];
  const filtered = options.filter(
    (o) =>
      (!category || o.category === category) &&
      (o.name + ' ' + o.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      {notice && <output className="proposal-client-notice">{notice}</output>}
      {!data.editable && (
        <p className="proposal-client-notice">{data.editReason}</p>
      )}
      <ProposalDocument
        summary={data.summary}
        business={business}
        attachments={attachments}
        discountControl={
          data.editable && data.showDiscountCode ? (
            <ProposalDiscountForm
              appliedCode={data.summary.discountCode}
              busy={busy}
              error={discountError}
              onApply={(code) => void applyDiscount(code)}
            />
          ) : undefined
        }
        onManage={
          data.editable && !busy
            ? (kind, packageId) => {
                setPicker({ kind, packageId });
                setDraft(structuredClone(data.selections));
                setReview(null);
                setError('');
                setSearch('');
                setCategory('');
              }
            : undefined
        }
      />
      <Dialog
        open={!!picker}
        onOpenChange={(open) => {
          if (!open && !busy) setPicker(null);
        }}
      >
        <DialogContent
          className="crm-dialog proposal-options-dialog"
          showCloseButton={!busy}
        >
          <DialogTitle>
            {picker?.kind === 'addons'
              ? 'Manage add-ons'
              : 'Choose your backdrop'}
          </DialogTitle>
          <DialogDescription>
            {data.summary.items.find((p) => p.id === picker?.packageId)?.name} ·
            Review the updated price before saving your choices.
          </DialogDescription>
          <div className="proposal-option-filters">
            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {[...new Set(options.map((o) => o.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="proposal-option-grid">
            {filtered.map((o) => {
              const selected =
                o.kind === 'addons'
                  ? draft.addonIds.includes(o.id) || o.locked
                  : draft.backdropId === o.id;
              const parent =
                draft.extraPackageIds[o.id] ||
                data.summary.extras.find((x) => x.id === o.id)?.packageId ||
                o.packages[0]?.id;
              const here = selected && parent === picker?.packageId;
              const price = o.packages.find((p) => p.id === picker?.packageId)!;
              return (
                <article
                  key={o.id}
                  className={
                    'proposal-option-card' + (here ? ' is-selected' : '')
                  }
                >
                  {o.imageUrl && (
                    <Image
                      unoptimized
                      width={400}
                      height={180}
                      src={o.imageUrl}
                      alt={o.name}
                    />
                  )}
                  <small>{o.category}</small>
                  <h3>{o.name}</h3>
                  <p className="proposal-preserve">{o.description}</p>
                  <strong>
                    {price.included ? 'One included' : money(price.price)}
                    {o.maxQuantity > 1
                      ? price.included
                        ? ' · additional units ' + money(price.price) + ' each'
                        : ' · per unit'
                      : ''}
                  </strong>
                  {selected && !here && (
                    <p>
                      Selected for{' '}
                      {data.summary.items.find((p) => p.id === parent)?.name}.
                      Choosing here moves it to this package.
                    </p>
                  )}
                  <button
                    type="button"
                    className={here ? 'secondary' : 'primary'}
                    disabled={busy || (here && o.locked)}
                    onClick={() => {
                      if (!picker) return;
                      const next = {
                        ...draft,
                        addonIds: [...draft.addonIds],
                        extraPackageIds: {
                          ...draft.extraPackageIds,
                          [o.id]: picker.packageId,
                        },
                      };
                      if (o.kind === 'addons')
                        next.addonIds = here
                          ? next.addonIds.filter((id) => id !== o.id)
                          : [...new Set([...next.addonIds, o.id])];
                      else next.backdropId = here ? '' : o.id;
                      change(next);
                    }}
                  >
                    {here
                      ? o.locked
                        ? 'Included with package'
                        : 'Remove'
                      : 'Choose'}
                  </button>
                  {here &&
                    o.kind === 'addons' &&
                    o.maxQuantity > 1 &&
                    !o.fixedQuantity && (
                      <label>
                        Quantity for {o.name}
                        <input
                          type="number"
                          min="1"
                          max={o.maxQuantity}
                          step="1"
                          value={
                            draft.addonQuantities[o.id] === 0
                              ? ''
                              : (draft.addonQuantities[o.id] ?? 1)
                          }
                          disabled={busy}
                          onChange={(e) =>
                            change({
                              ...draft,
                              addonQuantities: {
                                ...draft.addonQuantities,
                                [o.id]:
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    )}
                </article>
              );
            })}
            {!filtered.length && (
              <p className="proposal-empty">
                No {picker?.kind === 'addons' ? 'add-ons' : 'backdrops'} match
                these filters for this package.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {review && (
            <div className="proposal-selection-review" aria-live="polite">
              <h3>Review your updated proposal</h3>
              <p>
                Total: {money(data.summary.total)} →{' '}
                <strong>{money(review.summary.total)}</strong>
              </p>
              <p>
                Retainer due:{' '}
                {money(
                  Math.max(0, review.summary.deposit - review.summary.paid),
                )}{' '}
                · Remaining balance:{' '}
                {money(Math.max(0, review.summary.total - review.summary.paid))}
              </p>
              <p>
                Saving these choices keeps this as a proposal. The business will
                confirm your booking.
              </p>
            </div>
          )}
          <div className="proposal-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setPicker(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => submit(review ? 'save' : 'quote')}
            >
              {busy
                ? 'Working…'
                : review
                  ? 'Save selections'
                  : 'Review updated total'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
