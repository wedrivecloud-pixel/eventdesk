'use client';
/* oxlint-disable react/react-compiler -- The effect synchronizes loading state with a network request; Date.UTC is a native date function. */
import { useEffect, useState } from 'react';
import type { WidgetOptions } from '@/lib/website-integration';
import { WidgetFrame } from '../../../widget-frame';
import { SChoice, SField } from '../../../sales-ui';
export default function AvailabilityWidget({
  business,
  packages,
  options,
}: {
  business: { id: string; name: string; timezone: string };
  packages: { id: string; name: string; minutes: number }[];
  options: WidgetOptions;
}) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: business.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [date, setDate] = useState(today),
    [month, setMonth] = useState(today.slice(0, 7)),
    [packageId, setPackage] = useState(packages[0]?.id || ''),
    [loading, setLoading] = useState(false),
    [available, setAvailable] = useState<boolean | null>(null),
    [error, setError] = useState('');
  const p = packages.find((p) => p.id === packageId),
    first = new Date(month + '-01T12:00:00Z'),
    offset = first.getUTCDay(),
    count = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
  const selectedId = p?.id,
    selectedMinutes = p?.minutes;
  useEffect(() => {
    setAvailable(null);
    setError('');
    if (!selectedId || selectedMinutes === undefined) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(
      '/api/booking?' +
        new URLSearchParams({
          package: selectedId,
          date,
          minutes: String(selectedMinutes),
        }),
      { signal: controller.signal },
    )
      .then(async (r) => {
        const j = (await r.json()) as { available?: boolean; error?: string };
        if (r.ok) {
          setAvailable(j.available === true);
          return;
        }
        if (r.status === 400) {
          setAvailable(false);
          return;
        }
        throw Error(j.error || 'Unable to check availability.');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, selectedMinutes, date]);
  const changeDay = (d: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDate(d);
      setMonth(d.slice(0, 7));
    }
  };
  const move = (n: number) => {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const href =
    options.customBookingUrl ||
    '/book/' +
      encodeURIComponent(packageId) +
      '?' +
      new URLSearchParams({ date });
  return (
    <WidgetFrame options={options}>
      <main className="widget-availability form-stack">
        {!options.embed && <p>{business.name}</p>}
        <h1>Check availability</h1>
        <p>
          Choose a package and date. Times are shown in {business.timezone}.
        </p>
        {!p ? (
          <p>No packages are currently available for online booking.</p>
        ) : (
          <>
            <SChoice
              label="Package"
              value={packageId}
              options={packages.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setPackage}
            />
            <div className="panel-heading">
              <button
                className="widget-button"
                aria-label="Previous month"
                disabled={month <= today.slice(0, 7)}
                onClick={() => move(-1)}
              >
                ←
              </button>
              <h2>
                {new Intl.DateTimeFormat('en-US', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(first)}
              </h2>
              <button
                className="widget-button"
                aria-label="Next month"
                onClick={() => move(1)}
              >
                →
              </button>
            </div>
            <div className="widget-date-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d}>{d}</span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={'empty' + i} />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const d = month + '-' + String(i + 1).padStart(2, '0');
                return (
                  <button
                    key={d}
                    aria-label={'Choose ' + d}
                    aria-pressed={d === date}
                    disabled={d < today}
                    onClick={() => changeDay(d)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <SField
              label="Event date"
              type="date"
              value={date}
              onChange={changeDay}
            />
            <div className="widget-availability-result" aria-live="polite">
              {loading ? (
                <p>Checking availability…</p>
              ) : error ? (
                <p role="alert">{error}</p>
              ) : available !== null ? (
                <>
                  <h3>
                    {available ? 'Currently available' : 'Unavailable online'}
                  </h3>
                  <p>
                    {available
                      ? options.availableMessage
                      : options.unavailableMessage}
                  </p>
                  {available && options.button && (
                    <a href={href} target="_top" className="widget-button">
                      {options.buttonText || 'Book Now'}
                    </a>
                  )}
                  <p>
                    <small>
                      Availability is checked again when you submit. Your
                      request requires approval.
                    </small>
                  </p>
                </>
              ) : null}
            </div>
          </>
        )}
      </main>
    </WidgetFrame>
  );
}
