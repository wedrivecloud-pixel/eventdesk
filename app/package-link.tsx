'use client';
import { useEffect, useState } from 'react';
import { Copy, Check, ExternalLink, Link2 } from 'lucide-react';
import type { PackageRecord } from '@/lib/crm';
import { LinkQR } from './link-qr';
export const packageLinkPath = (id: string) =>
  `/book/${encodeURIComponent(id)}`;
function htmlText(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}
export function PackageLink({ item }: { item: PackageRecord }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const href = origin ? origin + packageLinkPath(item.id) : '';
  const disabled = item.settings?.status === 'Disabled';
  const code = `<a href="${htmlText(href)}">${htmlText(item.name)}</a>`;
  async function copy(value: string, kind: string) {
    setError('');
    setCopied('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setError('Select the link or website code below and copy it manually.');
    }
  }
  return (
    <section className="package-link-box" aria-labelledby="package-link-title">
      <div className="package-link-heading">
        <Link2 size={19} />
        <h3 id="package-link-title">Want to link directly to this package?</h3>
        <span className="package-link-badge">Client booking page</span>
      </div>
      <p>Share this link or add it to your website:</p>
      <div className="package-link-row">
        <input
          aria-label="Direct package link"
          readOnly
          value={href}
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="secondary"
          disabled={!href || disabled}
          onClick={() => void copy(href, 'link')}
        >
          {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}{' '}
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </button>
        {!disabled && (
          <a
            className="secondary"
            href={packageLinkPath(item.id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open booking page <ExternalLink size={15} />
          </a>
        )}
      </div>
      <p className="package-link-note">
        {disabled
          ? 'This package is disabled. Enable it and save before using its link.'
          : 'Clients can open this package without signing in and send a booking request for your approval. The date is not reserved and no payment is collected until you arrange it.'}
      </p>
      {!disabled && (
        <details>
          <summary>Website link code</summary>
          <textarea
            aria-label="Website link code"
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
            {copied === 'code' ? <Check size={15} /> : <Copy size={15} />}{' '}
            {copied === 'code' ? 'Code copied' : 'Copy website code'}
          </button>
        </details>
      )}
      {!disabled && <LinkQR href={href} />}
      <span role="status" className="sr-only">
        {copied === 'link'
          ? 'Package link copied.'
          : copied === 'code'
            ? 'Website code copied.'
            : ''}
      </span>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
