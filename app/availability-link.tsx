'use client';
import { useEffect, useId, useState } from 'react';
import { Copy, Check, ExternalLink, CalendarDays } from 'lucide-react';
import { availabilityPath } from '@/lib/public-booking';
import { LinkQR } from './link-qr';
export function AvailabilityLink({
  businessId,
  scope,
}: {
  businessId: string;
  scope?: { service: string; group?: string };
}) {
  const [origin, setOrigin] = useState(''),
    [copied, setCopied] = useState(''),
    [error, setError] = useState(''),
    heading = useId();
  useEffect(() => setOrigin(window.location.origin), []);
  const path =
      availabilityPath(businessId) +
      (scope
        ? '&' +
          new URLSearchParams({
            service: scope.service,
            ...(scope.group === undefined ? {} : { group: scope.group }),
          })
        : ''),
    href = origin ? origin + path : '',
    code =
      '<a href="' +
      href.replaceAll('&', '&amp;').replaceAll('"', '&quot;') +
      '">Check availability</a>';
  async function copy(value: string, kind: string) {
    setError('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setError('Select the link or website code and copy it manually.');
    }
  }
  return (
    <section
      className="package-link-box availability-link"
      aria-labelledby={heading}
    >
      <div className="package-link-heading">
        <CalendarDays size={19} />
        <h3 id={heading}>
          {scope
            ? scope.group === undefined
              ? 'Service booking link'
              : 'Package-group booking link'
            : 'Check availability page'}
        </h3>
        <span className="package-link-badge">All public packages</span>
      </div>
      <p>
        Share this package selection with clients or add it to your website.
      </p>
      <div className="package-link-row">
        <input
          aria-label="All packages booking link"
          readOnly
          value={href}
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="secondary"
          disabled={!href}
          onClick={() => void copy(href, 'link')}
        >
          {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}{' '}
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
        <a
          className="secondary"
          href={path}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open booking page <ExternalLink size={15} />
        </a>
      </div>
      <p className="package-link-note">
        Lists Public packages from your enabled services. Clients choose a
        package, check dates and send a request for your approval. Site access
        controls also apply to this link.
      </p>
      <details>
        <summary>Website link code</summary>
        <textarea
          aria-label="All packages website link code"
          readOnly
          rows={3}
          value={code}
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="text-button"
          disabled={!href}
          onClick={() => void copy(code, 'code')}
        >
          {copied === 'code' ? 'Code copied' : 'Copy website code'}
        </button>
      </details>
      <LinkQR href={href} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <span role="status" className="sr-only">
        {copied ? 'Copied ' + copied : ''}
      </span>
    </section>
  );
}
