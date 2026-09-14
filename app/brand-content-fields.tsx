'use client';
import { useState, type ReactNode } from 'react';
import type { Data } from '@/lib/crm';
import {
  invoiceContactFields,
  presentationFromSettings,
  trustIndicatorTypes,
  type BrandPresentation,
} from '@/lib/brand-presentation';
import { MediaPicker, MSection } from './manage-editors';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
type Contact = {
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
};
export function BrandContactFields({
  value,
  onChange,
}: {
  value: Contact;
  onChange: (patch: Partial<Contact>) => void;
}) {
  return (
    <MSection title="Brand contact">
      <div className="form-grid">
        {(
          [
            ['name', 'Brand name', 'text', 120],
            ['email', 'Public email', 'email', 254],
            ['phone', 'Public phone', 'tel', 40],
            ['website', 'Website', 'url', 500],
          ] as const
        ).map(([key, label, type, max]) => (
          <Field key={key} label={label}>
            <input
              type={type}
              required={key === 'name' || key === 'email'}
              maxLength={max}
              value={value[key]}
              onChange={(e) => onChange({ [key]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <Field label="Brand address">
        <textarea
          value={value.address}
          maxLength={1000}
          placeholder="Street, suite, city, state / province, ZIP / postal code"
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </Field>
    </MSection>
  );
}
export function BrandPresentationFields({
  value,
  data,
  onChange,
}: {
  value: BrandPresentation;
  data: Data;
  onChange: (patch: Partial<BrandPresentation>) => void;
}) {
  const indicators = value.trustIndicators || [];
  return (
    <>
      <MSection title="Invoices and proposals">
        <label className="brand-package-option">
          <input
            type="checkbox"
            checked={value.showAddress !== false}
            onChange={(e) => onChange({ showAddress: e.target.checked })}
          />
          Show my address on invoices and proposals
        </label>
        <label className="brand-package-option">
          <input
            type="checkbox"
            checked={value.overrideInvoice === true}
            onChange={(e) => onChange({ overrideInvoice: e.target.checked })}
          />
          Use different invoice and proposal contact details
        </label>
        {value.overrideInvoice && (
          <>
            <p className="muted">
              Use an alternate business name, address, logo or contact details
              on client documents. Blank name, email, phone and logo fields use
              the brand’s usual details.
            </p>
            <h4>Invoice and proposal logo</h4>
            <MediaPicker
              data={data}
              ids={value.invoiceLogoId ? [value.invoiceLogoId] : []}
              onChange={(ids) => onChange({ invoiceLogoId: ids.at(-1) || '' })}
              imageHint="Choose one PNG, JPEG or WebP logo."
            />
            <div className="form-grid">
              {invoiceContactFields.map(([key, label, max]) => (
                <Field key={key} label={label}>
                  <input
                    type={
                      key === 'invoiceEmail'
                        ? 'email'
                        : key === 'invoicePhone'
                          ? 'tel'
                          : 'text'
                    }
                    maxLength={max}
                    value={value[key] || ''}
                    onChange={(e) => onChange({ [key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
          </>
        )}
        <Field label="Proposal and invoice footer">
          <textarea
            maxLength={3000}
            value={value.footer || ''}
            onChange={(e) => onChange({ footer: e.target.value })}
          />
        </Field>
      </MSection>
      <MSection title="Proposals">
        <Field label="About Us">
          <textarea
            rows={6}
            maxLength={10000}
            value={value.about || ''}
            onChange={(e) => onChange({ about: e.target.value })}
          />
        </Field>
        <p className="muted">
          Appears on this brand’s proposals. A proposal preset’s own About Us
          text takes precedence.
        </p>
        <h4>Trust indicators</h4>
        <p className="muted">
          Add your own business statistics. Leave this empty if you don’t want
          to display statistics.
        </p>
        <div className="brand-trust-editor">
          {indicators.map((item, index) => (
            <div className="brand-trust-row" key={index}>
              <Field label={'Indicator ' + (index + 1)}>
                <select
                  value={item.type}
                  onChange={(e) =>
                    onChange({
                      trustIndicators: indicators.map((x, i) =>
                        i === index
                          ? { ...x, type: e.target.value as typeof item.type }
                          : x,
                      ),
                    })
                  }
                >
                  {trustIndicatorTypes.map((type) => (
                    <option
                      key={type}
                      disabled={
                        type !== item.type &&
                        indicators.some((x) => x.type === type)
                      }
                    >
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={'Value ' + (index + 1)}>
                <input
                  required
                  maxLength={60}
                  placeholder="e.g. 10+"
                  value={item.value}
                  onChange={(e) =>
                    onChange({
                      trustIndicators: indicators.map((x, i) =>
                        i === index ? { ...x, value: e.target.value } : x,
                      ),
                    })
                  }
                />
              </Field>
              <button
                className="secondary"
                type="button"
                aria-label={'Remove indicator ' + (index + 1)}
                onClick={() =>
                  onChange({
                    trustIndicators: indicators.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="secondary"
          disabled={indicators.length >= 12}
          onClick={() => {
            const type = trustIndicatorTypes.find(
              (t) => !indicators.some((i) => i.type === t),
            );
            if (type)
              onChange({
                trustIndicators: [...indicators, { type, value: '' }],
              });
          }}
        >
          Add trust indicator
        </button>
        {!!indicators.length && (
          <div
            className="brand-trust-preview"
            aria-label="Trust indicator preview"
          >
            {indicators.map((i, n) => (
              <div key={n}>
                <strong>{i.value || '—'}</strong>
                <span>{i.type}</span>
              </div>
            ))}
          </div>
        )}
      </MSection>
      <MSection title="Signature">
        <Field label="Message signature">
          <textarea
            rows={5}
            maxLength={3000}
            value={value.signature || ''}
            onChange={(e) => onChange({ signature: e.target.value })}
          />
        </Field>
        <p className="muted">
          Use <code>{'{{brand_signature}}'}</code> in a message template to
          insert this signature. Line breaks are preserved.
        </p>
        {value.signature && (
          <div className="brand-signature-preview">
            <strong>Signature preview</strong>
            <p>{value.signature}</p>
          </div>
        )}
      </MSection>
    </>
  );
}
export function PrimaryBrandDetails({
  data,
  onData,
}: {
  data: Data;
  onData: (d: Data) => void;
}) {
  const [value, setValue] = useState(() => ({
      ...presentationFromSettings(data.settings),
      name: data.business!.name,
      email: data.business!.email,
      phone: data.business!.phone || '',
      address: String(data.settings?.address || ''),
      website: String(data.settings?.website || ''),
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const change = (patch: Partial<typeof value>) => {
    setValue((v) => ({ ...v, ...patch }));
    setSaved(false);
  };
  return (
    <form
      className="form-stack brand-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        setSaved(false);
        try {
          const r = await fetch('/api/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_primary_brand_details',
              data: value,
            }),
          });
          const result = (await r.json()) as Data & { error?: string };
          if (!r.ok)
            throw Error(result.error || 'Unable to save brand details.');
          onData(result);
          setSaved(true);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to save brand details.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="brand-fields" disabled={busy}>
        <BrandContactFields value={value} onChange={change} />
        <BrandPresentationFields value={value} data={data} onChange={change} />
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {saved && <output>Brand details saved.</output>}
      <button disabled={busy} type="submit">
        {busy ? 'Saving…' : 'Save brand details'}
      </button>
    </form>
  );
}
