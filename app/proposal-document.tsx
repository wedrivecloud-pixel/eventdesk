import { money, prettyDate } from '@/lib/crm';
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { ProposalSummary, EventAttachment } from '@/lib/proposal';
export function ProposalDocument({
  summary: s,
  business,
  invoice = false,
  attachments = [],
  onManage,
  discountControl,
}: {
  summary: ProposalSummary;
  business: { name: string; email: string; phone: string; address?: string; website?: string };
  invoice?: boolean;
  attachments?: EventAttachment[];
  onManage?: (kind: 'addons' | 'backdrops', packageId: string) => void;
  discountControl?: ReactNode;
}) {
  return (
    <article className="proposal-paper">
      <header className="proposal-brand">
        <div>
          <p className="eyebrow">
            {invoice
              ? 'Invoice'
              : s.status === 'confirmed'
                ? 'Booking summary'
                : 'Proposal'}
          </p>
          <h2>{business.name}</h2>
          <p>
            {business.email}
            {business.phone ? ' · ' + business.phone : ''}
          </p>
          {business.address && <p className="proposal-preserve">{business.address}</p>}
          {business.website && <p><a href={business.website}>{business.website}</a></p>}
        </div>
        <strong>{s.invoice.number}</strong>
      </header>
      <h2>{s.title}</h2>
      {!invoice && s.intro && <p className="proposal-intro">{s.intro}</p>}
      {!invoice && s.presentation?.about && (
        <section>
          <h3>About us</h3>
          <p className="proposal-preserve">{s.presentation.about}</p>
        </section>
      )}
      <div className="proposal-facts">
        <div>
          <small>PREPARED FOR</small>
          <h3>{invoice ? s.invoice.recipient : s.client}</h3>
          <p>{invoice ? s.invoice.email : s.email}</p>
        </div>
        <div>
          <small>EVENT DETAILS</small>
          <h3>
            {prettyDate(s.date)}
            {s.time ? ' · ' + s.time : ''}
          </h3>
          <p>{s.venue || 'Venue to be confirmed'}</p>
        </div>
      </div>
      {invoice && (
        <div className="proposal-facts">
          <p>Invoice date: {prettyDate(s.invoice.issuedOn)}</p>
          <p>Payment due: {prettyDate(s.invoice.dueOn)}</p>
          {s.invoice.poNumber && <p>PO number: {s.invoice.poNumber}</p>}
        </div>
      )}
      {!invoice && (
        <section className="proposal-package-details">
          <h3>Package details</h3>
          {s.items.map((p) => (
            <section className="proposal-package-detail" key={p.id}>
              <div className="proposal-package-heading">
                {p.imageUrl && (
                  <Image
                    unoptimized
                    width={180}
                    height={240}
                    src={p.imageUrl}
                    alt={p.name}
                  />
                )}
                <div>
                  <small>{p.service}</small>
                  <h3>{p.name}</h3>
                  <p>
                    {prettyDate(s.date)} · {s.time} · {p.duration}
                  </p>
                  {p.description && (
                    <p className="proposal-preserve">{p.description}</p>
                  )}
                </div>
              </div>
              {(['addons', 'backdrops'] as const).map((kind) => (
                <div className="proposal-selected-extras" key={kind}>
                  <div className="proposal-section-heading">
                    <h4>{kind === 'addons' ? 'Add-ons' : 'Backdrop'}</h4>
                    {onManage && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => onManage(kind, p.id)}
                      >
                        {kind === 'addons'
                          ? 'Manage add-ons'
                          : 'Choose your backdrop'}
                      </button>
                    )}
                  </div>
                  {!s.extras.some(
                    (x) => x.kind === kind && x.packageId === p.id,
                  ) && (
                    <p className="proposal-empty">
                      {kind === 'addons'
                        ? 'No add-ons selected.'
                        : 'No backdrop selected.'}
                    </p>
                  )}
                  {s.extras
                    .filter((x) => x.kind === kind && x.packageId === p.id)
                    .map((x) => (
                      <div key={x.id} className="proposal-extra-detail">
                        {x.imageUrl && (
                          <Image
                            unoptimized
                            width={90}
                            height={90}
                            src={x.imageUrl}
                            alt={x.name}
                          />
                        )}
                        <div>
                          <strong>{x.name}</strong>
                          <p>
                            Quantity: {x.quantity} ·{' '}
                            {x.included && x.price === 0
                              ? 'Included'
                              : money(x.price)}
                            {x.included && x.price > 0 ? ' (one included)' : ''}
                          </p>
                          {x.description && (
                            <p className="proposal-preserve">{x.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </section>
          ))}
        </section>
      )}
      {!invoice && s.presentation?.pricingTitle && (
        <h3>{s.presentation.pricingTitle}</h3>
      )}
      <div className="proposal-table-wrap">
        <table className="proposal-invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {s.items.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <small>
                    {p.service} · {p.duration}
                  </small>
                </td>
                <td>1</td>
                <td>{money(p.price)}</td>
                <td>{money(p.price)}</td>
              </tr>
            ))}
            {s.extras.map((x, i) => (
              <tr key={'extra' + i}>
                <td>{x.name}</td>
                <td>{x.quantity}</td>
                <td>
                  {money(x.unitPrice)}
                  {x.included && <small>One included</small>}
                </td>
                <td>{money(x.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!invoice && discountControl}
      <dl className="proposal-totals" aria-live="polite">
        {s.adjustment !== 0 && (
          <>
            <dt>Flexible pricing</dt>
            <dd>{money(s.adjustment)}</dd>
          </>
        )}
        {s.discount > 0 && (
          <>
            <dt>Discount{s.discountCode ? ` (${s.discountCode})` : ''}</dt>
            <dd>−{money(s.discount)}</dd>
          </>
        )}
        {s.tax > 0 && (
          <>
            <dt>{s.taxLabel}</dt>
            <dd>{money(s.tax)}</dd>
          </>
        )}
        {s.travel > 0 && (
          <>
            <dt>Travel</dt>
            <dd>{money(s.travel)}</dd>
          </>
        )}
        <dt>Total · USD</dt>
        <dd>
          <strong>{money(s.total)}</strong>
        </dd>
        <dt>Retainer / deposit requested</dt>
        <dd>{money(s.deposit)}</dd>
        <dt>Payments collected</dt>
        <dd>{money(s.paid)}</dd>
        <dt>Balance</dt>
        <dd>
          <strong>{money(Math.max(0, s.total - s.paid))}</strong>
        </dd>
      </dl>
      {!invoice && (
        <section className="proposal-retainer">
          <div>
            <span>Retainer due</span>
            <strong>
              {money(Math.max(0, Math.min(s.deposit, s.total) - s.paid))}
            </strong>
          </div>
          <p>
            {s.deposit === 0
              ? 'No retainer requested.'
              : s.paid >= s.deposit
                ? 'Your retainer has been covered by recorded payments.'
                : 'Applied toward your total, not an additional charge.'}
          </p>
          <p>
            Remaining after retainer:{' '}
            {money(Math.max(0, s.total - Math.max(s.deposit, s.paid)))} ·
            Payment due {prettyDate(s.invoice.dueOn)}
          </p>
        </section>
      )}
      {s.invoice.notes && (
        <section>
          <h3>Invoice notes</h3>
          <p className="proposal-preserve">{s.invoice.notes}</p>
        </section>
      )}
      {s.paymentPlan && (
        <section>
          <h3>{s.paymentPlan.name}</h3>
          {s.paymentPlan.schedule.map((p, i) => (
            <p key={i}>
              {prettyDate(p.date)} · {p.label}: {money(p.amount)}
            </p>
          ))}
        </section>
      )}
      {invoice && (
        <section>
          <h3>Payments</h3>
          {s.payments.length ? (
            s.payments.map((p) => (
              <p key={p.id}>
                {prettyDate(p.date)} · {p.method}: {money(p.amount)}
                {p.tip > 0 ? ' + ' + money(p.tip) + ' tip' : ''}
              </p>
            ))
          ) : (
            <p>No payments recorded.</p>
          )}
        </section>
      )}
      {!invoice && !!s.presentation?.reviews?.length && (
        <section>
          <h3>What clients say</h3>
          {s.presentation.reviews.map((r, i) => (
            <blockquote key={i}>
              <p>{r.body}</p>
              <footer>
                {r.reviewer} · {r.rating}/5
              </footer>
            </blockquote>
          ))}
        </section>
      )}
      {s.terms && (
        <section>
          <h3>Booking terms</h3>
          <p className="proposal-preserve">{s.terms}</p>
        </section>
      )}
      {s.validUntil && (
        <p>Proposal valid through {prettyDate(s.validUntil)}.</p>
      )}
      {!!attachments.length && (
        <section>
          <h3>Attachments</h3>
          {attachments.map((a) => (
            <p key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer">
                {a.name}
              </a>
            </p>
          ))}
        </section>
      )}
      <p className="proposal-disclaimer">
        Contact {business.name} to arrange acceptance and payment. This document
        is not a signed contract or payment receipt.
      </p>
    </article>
  );
}
