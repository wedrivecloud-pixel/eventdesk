import { notFound, redirect } from 'next/navigation';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor } from '@/db/store';
import { packageCatalog } from '@/db/package-catalog';
import { availabilityPath } from '@/lib/public-booking';
import {
  ArrowRight,
  Clock,
  Mail,
  Phone,
  Package,
  CalendarDays,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import './catalog.css';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Check availability | EventDesk',
  robots: { index: false, follow: false },
};
const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100);
async function OwnerCatalog() {
  const user = await requireChatGPTUser('/reservation/start'),
    business = await businessFor(user.userId);
  if (!business)
    return (
      <main className="catalog-empty">
        <h1>Create your business first</h1>
        <p>
          Your Check availability page will list the public packages in your
          business.
        </p>
        <a href="/">Open EventDesk</a>
      </main>
    );
  redirect(availabilityPath(String(business.id)));
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    business?: string | string[];
    service?: string | string[];
    group?: string | string[];
  }>;
}) {
  const query = await searchParams;
  if (query.business === undefined) return <OwnerCatalog />;
  if (
    typeof query.business !== 'string' ||
    !query.business ||
    query.business.length > 100
  )
    notFound();
  for (const key of ['service', 'group'] as const)
    if (
      query[key] !== undefined &&
      (typeof query[key] !== 'string' || query[key].length > 100)
    )
      notFound();
  const catalog = await packageCatalog(query.business, {
    service: query.service as string | undefined,
    group: query.group as string | undefined,
  });
  if (!catalog) notFound();
  const { business, groups } = catalog,
    count = groups.reduce((n, g) => n + g.packages.length, 0),
    services = [...new Set(groups.map((g) => g.service))];
  return (
    <div
      className={
        'availability-catalog ' +
        (catalog.layout === 'List' ? 'catalog-list-layout' : '')
      }
      style={
        {
          '--catalog-brand': catalog.color,
          background: catalog.background || undefined,
        } as CSSProperties
      }
    >
      <header className="catalog-header">
        <a href={availabilityPath(business.id)} className="catalog-brand">
          {catalog.logo ? (
            <img src={catalog.logo} alt="" />
          ) : (
            <span>{business.name.slice(0, 1)}</span>
          )}
          {business.name}
        </a>
        <span className="catalog-label">
          <CalendarDays size={17} />
          Check availability
        </span>
      </header>
      <main className="catalog-main">
        <div className="catalog-intro">
          {query.service && (
            <a href={availabilityPath(business.id)}>← All packages</a>
          )}
          <p className="catalog-eyebrow">Choose your package</p>
          <h1>
            {catalog.headline || 'Check availability. Choose your package.'}
          </h1>
          <p>
            {catalog.subheading ||
              'Browse our packages and choose the right fit for your event.'}
          </p>
          <p className="catalog-approval">
            Select a package to check dates and send a booking request for
            approval.
          </p>
        </div>
        {services.length > 1 && (
          <nav className="catalog-services" aria-label="Browse services">
            {services.map((s, i) => (
              <a key={s} href={'#service-' + i}>
                {s}
              </a>
            ))}
          </nav>
        )}
        {!count ? (
          <div className="catalog-empty">
            <Package size={32} />
            <h2>No packages are available online yet</h2>
            <p>Please contact {business.name} to discuss your event.</p>
          </div>
        ) : (
          services.map((service, i) => (
            <section
              id={'service-' + i}
              className="catalog-service"
              key={service}
            >
              <div className="catalog-service-heading">
                <h2
                  className={
                    catalog.servicePresentation[service]?.showTitle === false
                      ? 'sr-only'
                      : ''
                  }
                >
                  {service}
                </h2>
                <span>
                  {groups
                    .filter((g) => g.service === service)
                    .reduce((n, g) => n + g.packages.length, 0)}{' '}
                  packages
                </span>
              </div>
              {catalog.servicePresentation[service]?.subheader && (
                <p className="catalog-collection-subheader">
                  {catalog.servicePresentation[service].subheader}
                </p>
              )}
              {catalog.servicePresentation[service]?.image && (
                <img
                  className="catalog-collection-image"
                  src={catalog.servicePresentation[service].image}
                  alt={service}
                  loading="lazy"
                />
              )}
              {groups
                .filter((g) => g.service === service)
                .map((group) => (
                  <div className="catalog-group" key={group.name}>
                    {group.name && (
                      <h3
                        className={
                          group.presentation.showTitle ? '' : 'sr-only'
                        }
                      >
                        {group.name}
                      </h3>
                    )}
                    {group.presentation.subheader && (
                      <p className="catalog-collection-subheader">
                        {group.presentation.subheader}
                      </p>
                    )}
                    {group.image && (
                      <img
                        className="catalog-collection-image"
                        src={group.image}
                        alt={group.name || 'Package group'}
                        loading="lazy"
                      />
                    )}
                    <div className="catalog-grid">
                      {group.packages.map((p) => (
                        <article className="catalog-card" key={p.id}>
                          <a
                            className="catalog-photo"
                            href={'/book/' + encodeURIComponent(p.id)}
                            aria-label={'View ' + p.name}
                          >
                            {p.image ? (
                              <img
                                loading="lazy"
                                src={
                                  '/api/booking/image?' +
                                  new URLSearchParams({
                                    package: p.id,
                                    image: p.image.id,
                                  })
                                }
                                alt={p.image.alt || p.name}
                              />
                            ) : (
                              <span>
                                <Package size={36} />
                              </span>
                            )}
                          </a>
                          <div className="catalog-card-body">
                            <h3 className={p.showTitle ? '' : 'sr-only'}>
                              <a href={'/book/' + encodeURIComponent(p.id)}>
                                {p.name}
                              </a>
                            </h3>
                            {p.subheader && (
                              <p className="catalog-subheader">{p.subheader}</p>
                            )}
                            <div className="catalog-price">
                              {money(p.price)}
                              <small>
                                {p.unitMode === 'Per unit' &&
                                p.unitCalculation === 'Multiply package'
                                  ? ' / ' + p.unitLabel
                                  : ' starting price'}
                              </small>
                            </div>
                            <p className="catalog-duration">
                              <Clock size={16} />
                              {p.durationLabel} included
                            </p>
                            {p.extraDays && (
                              <p>
                                +{money(p.dailyRate * 100)} per additional day
                              </p>
                            )}
                            {p.extraHours && (
                              <p className="catalog-extra">
                                +{money(p.extraRate * 100)} per additional hour
                                {p.unitMode === 'Per unit' &&
                                p.unitCalculation === 'Multiply package'
                                  ? ' per ' + p.unitLabel
                                  : ''}
                              </p>
                            )}
                            <a
                              className="catalog-choose"
                              href={'/book/' + encodeURIComponent(p.id)}
                            >
                              {catalog.cta}
                              <ArrowRight size={17} />
                            </a>
                            {p.description && (
                              <p className="catalog-description">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
            </section>
          ))
        )}
        <footer className="catalog-footer">
          <strong>{business.name}</strong>
          <div>
            {business.phone && (
              <a href={'tel:' + business.phone.replace(/[^+\d]/g, '')}>
                <Phone size={15} />
                {business.phone}
              </a>
            )}
            {business.email && (
              <a href={'mailto:' + business.email}>
                <Mail size={15} />
                {business.email}
              </a>
            )}
          </div>
          <p>Booking requests powered by EventDesk</p>
        </footer>
      </main>
    </div>
  );
}
