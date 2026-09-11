'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImagePlus, Package, ArrowRight, Check, Trash2 } from 'lucide-react';
import {
  type PackageRecord,
  type PackageImage,
  type Data,
  money,
} from '@/lib/crm';
import {
  packageSettings,
  validatePackageSettings,
  imageUrl,
  type PackageSettings,
} from '@/lib/package-config';
import type { Save } from './forms';
import { PackageLink } from './package-link';
import { PackagePricingEditor } from './package-pricing-editor';
import { PackageNumberInput } from './package-number-input';
import { packageDurationLabel } from '@/lib/package-pricing';
function PhotoGallery({
  item,
  onChange,
}: {
  item: PackageRecord;
  onChange: (images: PackageImage[]) => void;
}) {
  const [working, setWorking] = useState(false),
    [error, setError] = useState('');
  async function change(method: string, id?: string, file?: File) {
    setWorking(true);
    setError('');
    try {
      if (
        file &&
        (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          file.size > 5 * 1024 * 1024)
      )
        throw new Error('Choose a PNG, JPEG or WebP under 5 MB.');
      const r = await fetch(
        `/api/package-images?package=${encodeURIComponent(item.id)}${id ? `&id=${encodeURIComponent(id)}` : ''}`,
        {
          method,
          headers: file ? { 'Content-Type': file.type } : undefined,
          body: file,
        },
      );
      const body = (await r.json()) as {
        images: PackageImage[];
        error?: string;
      };
      if (!r.ok) throw new Error(body.error);
      onChange(body.images);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update image.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="package-photo-section">
      <div className="panel-heading">
        <div>
          <h3>Package images</h3>
          <p className="muted">
            Primary image and additional photos · Up to 10 · PNG, JPEG or WebP ·
            5 MB each
          </p>
        </div>
      </div>
      <div className="package-photo-grid">
        {(item.images || []).map((img, i) => (
          <div className="package-photo" key={img.id}>
            <img src={imageUrl(img.id)} alt={img.alt || item.name} />
            <div>
              <span className="pill">
                {img.is_primary ? 'Primary image' : `Photo ${i + 1}`}
              </span>
              <div className="photo-actions">
                {!img.is_primary && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={working}
                    onClick={() => void change('PATCH', img.id)}
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Remove photo ${i + 1}`}
                  disabled={working}
                  onClick={() => void change('DELETE', img.id)}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <label className={`photo-upload ${working ? 'disabled' : ''}`}>
        <ImagePlus size={20} />
        {working
          ? 'Updating photos…'
          : item.images?.length
            ? 'Add photo'
            : 'Upload primary image'}
        <input
          aria-label="Upload package image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={working || (item.images?.length || 0) >= 10}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void change('PUT', undefined, f);
            e.target.value = '';
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function PackageEditor({
  item,
  options,
  data,
  onSave,
  busy,
  onImages,
  defaults = {},
}: {
  defaults?: { service?: string; group?: string };
  item?: PackageRecord;
  options: string[];
  data: Data;
  onSave: Save;
  busy: boolean;
  onImages: (id: string, images: PackageImage[]) => void;
}) {
  const [tab, setTab] = useState(item ? 'Overview' : 'General'),
    [name, setName] = useState(item?.name || ''),
    [service, setService] = useState(
      item?.service || defaults.service || options[0] || '',
    ),
    [price, setPrice] = useState(item ? item.price / 100 : 0),
    [description, setDescription] = useState(item?.description || ''),
    [s, setS] = useState(
      packageSettings(
        item?.settings || {
          group: defaults.group || '',
          unitCalculation: 'Add unit charges',
          depositBasis: 'Booking total share',
          availabilityMode: 'Every day',
        },
        item?.duration,
      ),
    ),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  function update<K extends keyof PackageSettings>(
    key: K,
    value: PackageSettings[K],
  ) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }
  function select(
    label: string,
    value: string,
    values: string[],
    change: (v: string) => void,
  ) {
    return (
      <div className="field">
        <span>{label}</span>
        <Select value={value} onValueChange={(v) => change(String(v))}>
          <SelectTrigger aria-label={label}>
            <SelectValue>{value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {values.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  function choice<K extends keyof PackageSettings>(
    key: K,
    label: string,
    values: string[],
  ) {
    return select(
      label,
      typeof s[key] === 'string' ? (s[key] as string) : '',
      values,
      (v) => update(key, v as PackageSettings[K]),
    );
  }
  function number(
    key: keyof PackageSettings,
    label: string,
    min = 0,
    max = 1000000,
    step = 1,
  ) {
    return (
      <label className="field">
        <span>{label}</span>
        <PackageNumberInput
          min={min}
          max={max}
          step={step}
          value={Number(s[key])}
          onValueChange={(value) => update(key, value)}
        />
      </label>
    );
  }
  function toggle(
    key:
      | 'taxable'
      | 'extraHours'
      | 'showTitle'
      | 'requireBackdrop'
      | 'allowSkipBackdrop',
    label: string,
  ) {
    return (
      <label className="package-toggle">
        <Checkbox
          checked={s[key]}
          onCheckedChange={(v) => update(key, Boolean(v))}
        />
        <span>{label}</span>
      </label>
    );
  }
  function text(
    key: 'group' | 'subheader' | 'unitLabel' | 'startTime' | 'endTime',
    label: string,
    type = 'text',
    max = 250,
  ) {
    return (
      <label className="field">
        <span>{label}</span>
        <input
          type={type}
          maxLength={max}
          value={s[key]}
          onChange={(e) => update(key, e.target.value)}
        />
      </label>
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      if (!name.trim()) {
        setTab('General');
        throw Error('Enter a package title in General before saving.');
      }
      const config = validatePackageSettings(s, packageDurationLabel(s));
      const ok = await onSave({
        action: 'save_package',
        id: item?.id,
        name,
        service,
        price: Math.round(price * 100),
        duration: packageDurationLabel(s),
        description,
        settings: config,
      });
      if (ok) setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    }
  }
  const addons = (data.resources || []).filter(
      (r) => r.kind === 'addons' && !r.archived,
    ),
    photo = item?.images?.find((i) => i.is_primary) || item?.images?.[0];
  return (
    <form className="form-stack package-editor" onSubmit={submit}>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="package-tabs">
          {['Overview', 'General', 'Pricing & Scheduling', 'Advanced'].map(
            (t) => (
              <TabsTrigger key={t} value={t}>
                {t}
              </TabsTrigger>
            ),
          )}
        </TabsList>
        <TabsContent value="Overview">
          <div className="package-overview">
            <div className="package-cover">
              {photo ? (
                <img src={imageUrl(photo.id)} alt={photo.alt || name} />
              ) : (
                <div className="package-no-image">
                  <Package size={44} />
                  <span>No package image yet</span>
                </div>
              )}
            </div>
            <div>
              <span className="service-badge">{s.group || service}</span>
              <h2>{name || 'Your new package'}</h2>
              <p className="package-price">
                {money(Math.round(price * 100))}
                <small>
                  {' '}
                  starting rate
                  {s.unitMode === 'Per unit' &&
                  s.unitCalculation === 'Multiply package'
                    ? ` / ${s.unitLabel}`
                    : ''}
                </small>
              </p>
              <span className="pill">{s.status}</span>
              <p className="package-description">
                {description || 'Add a description in General.'}
              </p>
            </div>
          </div>
          {item && <PackageLink item={item} />}
          <div className="package-summary-grid">
            {[
              [
                'General',
                `${s.status} · ${s.group || service}`,
                `${item?.images?.length || 0} photos`,
              ],
              [
                'Pricing & Scheduling',
                `${packageDurationLabel(s)} included · ${s.durationUnit === 'Days' ? (s.extraDays ? money(Math.round(s.dailyRate * 100)) + '/extra day' : 'Fixed starting rate') : s.extraHours ? money(Math.round(s.extraRate * 100)) + '/extra hour' : 'Fixed starting rate'}`,
                `${s.depositMode === 'Business default' ? 'Business deposit settings' : s.depositMode === 'None' ? 'No deposit' : s.depositMode === 'Percentage' ? s.depositValue + '% deposit' : money(Math.round(s.depositValue * 100)) + ' deposit'}`,
              ],
              [
                'Advanced',
                s.bookingMode,
                `${s.requiredStaff} required staff · ${s.includedAddonIds.length} included add-ons`,
              ],
            ].map(([title, line, detail]) => (
              <section className="package-summary" key={title}>
                <h3>{title}</h3>
                <p>{line}</p>
                <small>{detail}</small>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setTab(title)}
                >
                  Edit {title}
                  <ArrowRight size={15} />
                </button>
              </section>
            ))}
          </div>
          {item && (
            <section className="package-summary">
              <h3>Upcoming bookings</h3>
              {data.events
                .filter(
                  (e) =>
                    e.status === 'confirmed' &&
                    e.date >= new Date().toISOString().slice(0, 10) &&
                    e.items.some((p) => p.id === item.id),
                )
                .map((e) => (
                  <p key={e.id}>
                    {e.date} · {e.title}
                  </p>
                ))}
              {!data.events.some(
                (e) =>
                  e.status === 'confirmed' &&
                  e.date >= new Date().toISOString().slice(0, 10) &&
                  e.items.some((p) => p.id === item.id),
              ) && (
                <p className="muted">No upcoming bookings for this package.</p>
              )}
            </section>
          )}
        </TabsContent>
        <TabsContent value="General" className="form-stack">
          <div className="section-intro">
            <h3>General</h3>
            <p>Give clients a clear picture of this package.</p>
          </div>
          <label className="field">
            <span>Package title</span>
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <div className="form-grid">
            {select(
              'Service',
              service,
              [...new Set([...options, service].filter(Boolean))],
              setService,
            )}
            {text('group', 'Package group (optional)', 'text', 100)}
            {choice('status', 'Status', ['Public', 'Private', 'Disabled'])}
          </div>
          <p className="muted">
            Public packages appear in the booking preview. Private packages are
            unlisted but clients with their direct link can request them.
            Disabled packages cannot receive new booking requests.
          </p>
          <label className="field">
            <span>Description / what’s included</span>
            <textarea
              rows={5}
              maxLength={3000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {item ? (
            <PhotoGallery
              item={item}
              onChange={(imgs) => onImages(item.id, imgs)}
            />
          ) : (
            <p className="package-hint">
              <ImagePlus size={20} />
              Save this package to upload its primary image and additional
              photos.
            </p>
          )}
        </TabsContent>
        <TabsContent value="Pricing & Scheduling" className="form-stack">
          <PackagePricingEditor
            settings={s}
            price={price}
            onPrice={(n) => {
              setPrice(n);
              setSaved(false);
            }}
            onChange={(config) => {
              setS(config);
              setSaved(false);
            }}
            busy={busy}
          />
        </TabsContent>
        <TabsContent value="Advanced" className="form-stack">
          <div className="section-intro">
            <h3>Advanced</h3>
            <p>
              Control presentation, booking requirements, and included extras.
            </p>
          </div>
          <fieldset>
            <legend>Booking page</legend>
            {toggle('showTitle', 'Show package title on booking page')}
            {text('subheader', 'Subheader')}
            {choice('bookingMode', 'Booking request mode', [
              'Booking request',
              'Proposal request',
              'Lead form',
            ])}
            <p className="muted">
              All online requests are saved in Leads for your approval, with the
              selected request type recorded. Dates are reserved only when you
              confirm a booking.
            </p>
          </fieldset>
          <fieldset>
            <legend>Requirements</legend>
            <div className="form-grid">
              {number('leadDays', 'Package minimum lead time (days)', 0, 730)}
              {number('requiredStaff', 'Required staff', 0, 100)}
            </div>
            <p className="muted">
              Staff assignments and lead time are checked before confirming a
              booking.
            </p>
            {toggle('requireBackdrop', 'Require a backdrop')}
            {s.requireBackdrop &&
              toggle(
                'allowSkipBackdrop',
                'Allow backdrop selection to be skipped',
              )}
          </fieldset>
          <fieldset>
            <legend>Included add-ons</legend>
            <p className="muted">
              These add-ons appear in event quotes at no additional charge.
            </p>
            {addons.length ? (
              <div className="package-choices">
                {addons.map((a) => (
                  <label className="check-card" key={a.id}>
                    <Checkbox
                      checked={s.includedAddonIds.includes(a.id)}
                      onCheckedChange={(v) =>
                        update(
                          'includedAddonIds',
                          v
                            ? [...s.includedAddonIds, a.id]
                            : s.includedAddonIds.filter((x) => x !== a.id),
                        )
                      }
                    />
                    <span>{a.name}</span>
                    <small>Included</small>
                  </label>
                ))}
              </div>
            ) : (
              <p>Add your extras under Manage → Add-ons first.</p>
            )}
          </fieldset>
        </TabsContent>
      </Tabs>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer package-save">
        <span>
          {saved ? (
            <>
              <Check size={15} />
              Package saved.
            </>
          ) : (
            <>
              Existing proposals keep their quoted prices and package rules.
              Photos save immediately.
            </>
          )}
        </span>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : item ? 'Save package changes' : 'Save package'}
        </button>
      </div>
    </form>
  );
}
