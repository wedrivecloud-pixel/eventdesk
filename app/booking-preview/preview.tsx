'use client';
import { useState } from 'react';
import { EventForm } from '@/app/forms';
import { mergedSettings } from '@/lib/settings';
import type { Data } from '@/lib/crm';
import { orderedPackages } from '@/lib/package-manager';
export default function BookingPreview({
  initial,
  packageId = '',
}: {
  initial: Data;
  packageId?: string;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false);
  const settings = mergedSettings(data.settings);
  const selected = data.packages.find((p) => p.id === packageId);
  return (
    <main
      className="booking-preview"
      style={{ '--brand-color': String(settings.color) } as React.CSSProperties}
    >
      <a className="text-button" href="/app">
        ← Back to workspace
      </a>
      <p className="preview-label">
        Owner preview · This page is not a public booking link.
      </p>
      <header className="preview-brand">
        {settings.logoVersion && (
          <img
            alt="Business logo"
            src={`/api/logo?v=${settings.logoVersion}`}
          />
        )}
        <h1>{data.business?.name || 'Create your business first'}</h1>
      </header>
      <section className="welcome-panel">
        <div>
          <h2>
            {selected
              ? selected.settings?.showTitle === false
                ? selected.service
                : selected.name
              : String(settings.headline)}
          </h2>
          <p>
            {selected
              ? selected.settings?.subheader || selected.description
              : String(settings.subheading)}
          </p>
          <span className="pill">{String(settings.cta)}</span>
        </div>
      </section>
      {success ? (
        <section className="panel">
          <h2>Inquiry saved.</h2>
          <p>It is now in your business’s Leads list.</p>
          <a href="/app" className="primary">
            Return to workspace
          </a>
        </section>
      ) : (
        data.business && (
          <section className="panel">
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <EventForm
              preview
              packageLinkId={packageId}
              packages={orderedPackages(data)}
              data={data}
              busy={busy}
              onSave={async (body) => {
                setBusy(true);
                setError('');
                try {
                  const r = await fetch('/api/crm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  const result = (await r.json()) as Data & { error?: string };
                  if (!r.ok) throw new Error(result.error);
                  setData(result);
                  setSuccess(true);
                  return true;
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Unable to save.');
                  return false;
                } finally {
                  setBusy(false);
                }
              }}
            />
          </section>
        )
      )}
    </main>
  );
}
