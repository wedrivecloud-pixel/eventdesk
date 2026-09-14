import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { proposalAccess } from '@/db/proposals';
import { type EventAttachment } from '@/lib/proposal';
import { rawDb } from '@/db/raw';
import { proposalClientData } from '@/db/proposal-options';
import { ProposalClient } from '@/app/proposal-client';
import { ProposalDocument } from '@/app/proposal-document';
import PrintButton from './print-button';
import '@/app/proposal-workspace.css';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Proposal | Eventdeskly',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default async function Proposal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; view?: string }>;
}) {
  const { id } = await params,
    q = await searchParams,
    access = await proposalAccess(id, q.token || '');
  if (!access) notFound();
  const rows = (
    await rawDb()
      .prepare(
        "SELECT id,data FROM sales_records WHERE business_id=? AND kind='event_attachment' AND archived=0 AND ed_text(data,'$.eventId')=? AND ed_number(data,'$.clientView')=1 ORDER BY created_at",
      )
      .bind(access.bid, id)
      .all<{ id: string; data: string }>()
  ).results;
  const token = q.token ? '&token=' + encodeURIComponent(q.token) : '';
  const attachments = rows.map((r) => {
    const a = JSON.parse(r.data);
    return {
      id: r.id,
      name: a.name,
      kind: a.kind,
      url:
        a.kind === 'Link'
          ? a.url
          : '/api/event-attachments?event=' +
            encodeURIComponent(id) +
            '&id=' +
            encodeURIComponent(r.id) +
            token,
    };
  }) as EventAttachment[];
  const base =
    '/proposal/' +
    id +
    (q.token ? '?token=' + encodeURIComponent(q.token) : '?');
  const {
    client,
    config: { settings, resources },
    media,
  } = await proposalClientData(access, q.token || '');
  return (
    <main
      className="proposal-document"
      data-theme={
        access.event.operations?.quote?.presentation?.theme || 'Classic'
      }
      style={{ '--brand-color': String(settings.color) } as React.CSSProperties}
    >
      <div className="print-controls">
        {access.owner && <Link href="/app">← Back to workspace</Link>}
        <a href={base + (q.token ? '&' : '') + 'view=proposal'}>Proposal</a>
        <a href={base + (q.token ? '&' : '') + 'view=invoice'}>Invoice</a>
        <PrintButton />
      </div>
      {q.view === 'invoice' ? (
        <ProposalDocument
          summary={client.summary}
          business={access.business}
          invoice={q.view === 'invoice'}
          attachments={attachments}
        />
      ) : (
        <ProposalClient
          initial={client}
          business={access.business}
          attachments={attachments}
          token={q.token || ''}
        />
      )}
      {q.view !== 'invoice' &&
        !!access.event.operations?.quote?.presentation?.images.length && (
          <section className="proposal-gallery">
            {access.event.operations.quote.presentation.images.map(
              (imageId) => (
                <Image
                  unoptimized
                  width={600}
                  height={400}
                  key={imageId}
                  src={media + '&id=' + encodeURIComponent(imageId)}
                  alt="Event inspiration"
                />
              ),
            )}
          </section>
        )}
      {resources
        .filter(
          (r) =>
            r.kind === 'payment_methods' &&
            !r.archived &&
            r.data.enabled !== false &&
            r.data.showInvoice,
        )
        .map((r) => (
          <section key={r.id}>
            <h3>{r.name}</h3>
            <p className="proposal-preserve">
              {String(r.data.instructions || '')}
            </p>
          </section>
        ))}
      <footer>{String(settings.footer || 'Prepared with Eventdeskly')}</footer>
    </main>
  );
}
