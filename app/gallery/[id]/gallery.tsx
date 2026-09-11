'use client';
/* oxlint-disable next/no-img-element -- Gallery media is served through the existing scoped public-media endpoint. */
import { useState } from 'react';
import type { publicGalleryRows } from '@/db/manage-public';
import type { WidgetOptions } from '@/lib/website-integration';
import { money } from '@/lib/crm';
import { WidgetFrame } from '../../widget-frame';
import { DesignPreview } from '../../design-preview';
export default function GalleryView({
  business,
  kind,
  title,
  rows,
  options,
  bookingHref,
}: {
  business: { id: string; name: string };
  kind: string;
  title: string;
  rows: ReturnType<typeof publicGalleryRows>;
  options: WidgetOptions;
  bookingHref: string;
}) {
  const [tag, setTag] = useState(''),
    [page, setPage] = useState(1),
    tags = [
      ...new Map(rows.flatMap((r) => r.tags).map((t) => [t.id, t])).values(),
    ],
    filtered = rows.filter((r) => !tag || r.tags.some((t) => t.id === tag)),
    pages = Math.max(1, Math.ceil(filtered.length / options.pageSize)),
    current = Math.min(page, pages),
    shown = filtered.slice(
      (current - 1) * options.pageSize,
      current * options.pageSize,
    );
  return (
    <WidgetFrame options={options}>
      <main>
        {!options.embed && <p>{business.name}</p>}
        <h1>{title}</h1>
        {kind === 'designs' && options.showTags && tags.length > 0 && (
          <nav
            aria-label="Design categories"
            className="widget-gallery-controls"
          >
            <button
              aria-pressed={!tag}
              onClick={() => {
                setTag('');
                setPage(1);
              }}
            >
              All designs
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                aria-pressed={tag === t.id}
                onClick={() => {
                  setTag(t.id);
                  setPage(1);
                }}
              >
                {t.name}
              </button>
            ))}
          </nav>
        )}
        <div className="manage-cards">
          {shown.map((r) => (
            <article className="manage-resource-card" key={r.id}>
              {r.images[0] ? (
                <img
                  className="manage-card-image"
                  alt={r.name}
                  src={
                    '/api/public-media?' +
                    new URLSearchParams({
                      business: business.id,
                      item: r.id,
                      id: r.images[0],
                    })
                  }
                />
              ) : r.preset ? (
                <DesignPreview
                  item={{
                    id: r.id,
                    name: r.name,
                    kind: 'designs',
                    archived: 0,
                    data: { preset: r.preset },
                  }}
                />
              ) : null}
              <div className="manage-card-body">
                <small>{r.category}</small>
                {(kind !== 'backdrops' || options.showTitle) && (
                  <h2>{r.name}</h2>
                )}
                <p>{r.description}</p>
                {['addons', 'backdrops'].includes(kind) &&
                  options.price &&
                  r.price !== null && (
                    <b>
                      {money(r.price)}
                      {r.pricingMethod === 'Multiply by package hours'
                        ? ' / package hour'
                        : r.pricingMethod === 'Multiply by package days'
                          ? ' / package day'
                          : ''}
                    </b>
                  )}
                {r.videos.map((v) => (
                  <a href={v.url} key={v.url} target="_blank" rel="noreferrer">
                    {v.title}
                  </a>
                ))}
                {options.button && (
                  <a className="widget-button" href={bookingHref} target="_top">
                    {options.buttonText || 'Book Now'}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && <p>No gallery items are currently available.</p>}
        {pages > 1 && (
          <nav className="widget-gallery-pagination" aria-label="Gallery pages">
            <button
              className="widget-button"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              Page {current} of {pages}
            </span>
            <button
              className="widget-button"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </nav>
        )}
        {!shown.length && options.button && (
          <a href={bookingHref} className="widget-button" target="_top">
            {options.buttonText || 'Book Now'}
          </a>
        )}
      </main>
    </WidgetFrame>
  );
}
