'use client';
import { useState, type SyntheticEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { workspaceHref } from '@/lib/workspace-navigation';
import {
  Plus,
  Copy,
  ExternalLink,
  Pencil,
  Archive,
  RotateCcw,
  Building2,
} from 'lucide-react';
import type { Data } from '@/lib/crm';
import type { Resource } from '@/lib/settings';
import {
  brandRecords,
  brandDetails,
  brandBookingPath,
  brandSocialNetworks,
  type Brand,
} from '@/lib/brands';
import { MediaPicker, MSection } from './manage-editors';
import './brand-manager.css';
import {
  BrandContactFields,
  BrandPresentationFields,
  PrimaryBrandDetails,
} from './brand-content-fields';
function SField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

const empty: Brand = {
  id: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  color: '#315ee8',
  logoId: '',
  signature: '',
  footer: '',
  headline: '',
  subheading: '',
  packageMode: 'selected',
  packageIds: [],
};
export function BrandManager({
  data,
  onData,
  primaryEditor,
}: {
  data: Data;
  onData: (data: Data) => void;
  primaryEditor: ReactNode;
}) {
  const [editor, setEditor] = useState<Brand | null>(null),
    [primary, setPrimary] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [showArchived, setShowArchived] = useState(false),
    [archive, setArchive] = useState<Resource | null>(null);
  if (!data.business) return null;
  const business = data.business,
    records = brandRecords(data.resources || [], showArchived);
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        result = (await res.json()) as Data & { error?: string };
      if (!res.ok) throw Error(result.error || 'Unable to save brand.');
      onData(result);
      setEditor(null);
      setArchive(null);
      setNotice(
        body.action === 'archive_brand'
          ? 'Brand archived. Existing bookings keep their brand details.'
          : body.action === 'restore_brand'
            ? 'Brand restored.'
            : 'Brand saved.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save brand.');
    } finally {
      setBusy(false);
    }
  }
  async function copy(id = '') {
    const url = location.origin + brandBookingPath(business.id, id);
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Booking link copied.');
      setError('');
    } catch {
      setError(
        'Could not copy automatically. Open the booking page and copy its address.',
      );
    }
  }
  function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editor)
      void save({
        action: 'save_brand',
        id: editor.id,
        name: editor.name,
        data: editor,
      });
  }
  const update = (key: keyof Brand, value: string | Brand['packageIds']) =>
    setEditor((b) => (b ? { ...b, [key]: value } : b));
  return (
    <div className="brand-manager">
      <div className="brand-manager-heading">
        <div>
          <h2>Branding</h2>
          <p className="muted">
            Give each brand its own identity, packages and booking page. Manage
            all bookings in this workspace.
          </p>
        </div>
        {!editor && (
          <button
            className="primary"
            onClick={() => {
              setEditor({ ...empty, packageIds: [] });
              setPrimary(false);
              setError('');
              setNotice('');
            }}
          >
            <Plus size={17} /> Add another brand
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <output className="note">{notice}</output>}
      {editor ? (
        <form className="form-stack brand-editor panel" onSubmit={submit}>
          <h3>{editor.id ? 'Edit brand' : 'Add another brand'}</h3>
          <fieldset disabled={busy} className="brand-fields">
            <BrandContactFields
              value={editor}
              onChange={(patch) => setEditor({ ...editor, ...patch })}
            />
            <MSection title="Social media">
              <p className="muted">
                Add this brand’s profile or page links. Saved links appear on
                its booking pages. Leave a field blank to hide it.
              </p>
              <div className="form-grid">
                {brandSocialNetworks.map(({ key, label, placeholder }) => (
                  <SField key={key} label={label + ' URL (optional)'}>
                    <input
                      type="url"
                      maxLength={500}
                      placeholder={placeholder}
                      value={editor[key] || ''}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </SField>
                ))}
              </div>
            </MSection>
            <MSection title="Logo and color">
              <MediaPicker
                data={data}
                ids={editor.logoId ? [editor.logoId] : []}
                onChange={(ids) => update('logoId', ids.at(-1) || '')}
                imageHint="Choose one logo. PNG, JPEG or WebP; transparent artwork works well."
              />
              <SField label="Brand accent color">
                <input
                  type="color"
                  value={editor.color}
                  onChange={(e) => update('color', e.target.value)}
                />
              </SField>
            </MSection>
            <MSection title="Packages offered">
              <p className="muted">
                The same package can belong to several brands. Only public
                packages appear in the booking catalog.
              </p>
              <SField label="Package selection">
                <select
                  value={editor.packageMode}
                  onChange={(e) => update('packageMode', e.target.value)}
                >
                  <option value="selected">Selected packages</option>
                  <option value="all">All current and future packages</option>
                </select>
              </SField>
              {editor.packageMode === 'selected' && (
                <div className="brand-package-list">
                  {data.packages.map((p) => (
                    <label className="brand-package-option" key={p.id}>
                      <input
                        type="checkbox"
                        checked={editor.packageIds.includes(p.id)}
                        onChange={(e) =>
                          update(
                            'packageIds',
                            e.target.checked
                              ? [...editor.packageIds, p.id]
                              : editor.packageIds.filter((id) => id !== p.id),
                          )
                        }
                      />
                      <span>
                        {p.name}
                        <small>
                          {p.service} · {p.settings?.status || 'Public'}
                        </small>
                      </span>
                    </label>
                  ))}
                  {!data.packages.length && (
                    <p>
                      Create packages in Package Manager, then assign them here.
                    </p>
                  )}
                </div>
              )}
              {editor.packageMode === 'selected' &&
                !editor.packageIds.length && (
                  <p className="note">
                    This brand’s booking page will be empty until you assign
                    packages.
                  </p>
                )}
            </MSection>
            <MSection title="Client-facing details">
              <SField label="Booking headline (optional)">
                <input
                  maxLength={150}
                  value={editor.headline}
                  onChange={(e) => update('headline', e.target.value)}
                />
              </SField>
              <SField label="Booking introduction (optional)">
                <textarea
                  maxLength={1000}
                  value={editor.subheading}
                  onChange={(e) => update('subheading', e.target.value)}
                />
              </SField>
            </MSection>
            <BrandPresentationFields
              value={editor}
              data={data}
              onChange={(patch) => setEditor({ ...editor, ...patch })}
            />
          </fieldset>
          <div className="sales-actions">
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save brand'}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditor(null);
                setError('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <article className="panel brand-card">
            <div className="brand-card-identity">
              {data.settings?.logoVersion ? (
                <Image
                  unoptimized
                  width={128}
                  height={70}
                  src={'/api/logo?v=' + data.settings.logoVersion}
                  alt="Primary brand logo"
                />
              ) : (
                <Building2 size={32} />
              )}
              <div>
                <h3>{business.name}</h3>
                <span className="status confirmed">Primary brand</span>
                <p className="muted">{business.email}</p>
              </div>
            </div>
            <div className="sales-actions">
              <button
                className="secondary"
                onClick={() => setPrimary(!primary)}
              >
                <Pencil size={15} />
                {primary ? 'Close settings' : 'Edit primary branding'}
              </button>
              <button className="secondary" onClick={() => void copy()}>
                <Copy size={15} /> Copy booking link
              </button>
              <a
                className="button secondary"
                href={brandBookingPath(business.id)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} /> View booking page
              </a>
            </div>
            {primary && (
              <div className="brand-primary-editor">
                <Link
                  href={
                    workspaceHref('Business settings') +
                    '&panel=business-profile'
                  }
                >
                  Edit primary business name and contact details
                </Link>
                {primaryEditor}
                <PrimaryBrandDetails data={data} onData={onData} />
              </div>
            )}
          </article>
          <label className="brand-package-option">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />{' '}
            Show archived brands
          </label>
          {records.map((r) => {
            const b = brandDetails(r);
            return (
              <article className="panel brand-card" key={r.id}>
                <div className="brand-card-identity">
                  {b.logoId ? (
                    <Image
                      unoptimized
                      width={128}
                      height={70}
                      src={'/api/media?id=' + b.logoId}
                      alt={b.name + ' logo'}
                    />
                  ) : (
                    <span className="brand-monogram" style={{ color: b.color }}>
                      {b.name.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <h3>{b.name}</h3>
                    <p className="muted">
                      {b.email} {r.archived ? '· Archived' : ''}
                    </p>
                    <small>
                      {b.packageMode === 'all'
                        ? 'All packages'
                        : b.packageIds.filter((id) =>
                            data.packages.some((p) => p.id === id),
                          ).length + ' assigned packages'}
                    </small>
                  </div>
                </div>
                <div className="sales-actions">
                  {r.archived ? (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void save({ action: 'restore_brand', id: r.id })
                      }
                    >
                      <RotateCcw size={15} /> Restore brand
                    </button>
                  ) : (
                    <>
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditor(b);
                          setPrimary(false);
                          setError('');
                        }}
                      >
                        <Pencil size={15} /> Edit brand
                      </button>
                      <button
                        className="secondary"
                        onClick={() => void copy(b.id)}
                      >
                        <Copy size={15} /> Copy booking link
                      </button>
                      <a
                        className="button secondary"
                        href={brandBookingPath(business.id, b.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={15} /> View booking page
                      </a>
                      <button
                        className="secondary"
                        onClick={() => setArchive(r)}
                      >
                        <Archive size={15} /> Archive
                      </button>
                    </>
                  )}
                </div>
                {archive?.id === r.id && (
                  <div className="note">
                    <p>
                      Archive {r.name}? Its booking link will stop accepting new
                      requests. Existing bookings keep their details.
                    </p>
                    <div className="sales-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void save({ action: 'archive_brand', id: r.id })
                        }
                      >
                        Archive brand
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => setArchive(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {!records.length && (
            <p className="muted">
              Add another brand for a separate business identity or service
              line. Availability and payment settings are shared within this
              workspace.
            </p>
          )}
        </>
      )}
    </div>
  );
}
