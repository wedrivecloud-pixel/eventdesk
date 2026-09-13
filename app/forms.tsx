'use client';
import { durationRules, packageDurationLabel, unitBounds } from '@/lib/package-pricing';
import { PackageNumberInput } from './package-number-input';
import { EventExtras } from './event-tools';
import { ClientPicker } from './client-picker';
import { VenueAutocomplete } from './venue-autocomplete';
import { savedVenues } from '@/lib/venue-autocomplete';
import { brandRecords } from '@/lib/brands';
import {
  pricePackage,
  packageSettings,
  imageUrl,
  validatePackageSchedule,
  type PackageSelection,
} from '@/lib/package-config';
import type { LineItem } from '@/lib/crm';
import { useState, type FormEvent } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, Plus, Building2 } from 'lucide-react';
import {
  services,
  money,
  type Business,
  type PackageRecord,
  type EventRecord,
  type Data,
} from '@/lib/crm';
export type Save = (body: Record<string, unknown>) => Promise<boolean | void>;
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => onChange(String(v))}>
        <SelectTrigger aria-label={label}>
          <SelectValue>{value || 'Choose a service'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((x) => (
            <SelectItem key={x} value={x}>
              {x}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function BusinessForm({
  business,
  onSave,
  busy,
}: {
  business: Business | null;
  onSave: Save;
  busy: boolean;
}) {
  const [chosen, setChosen] = useState(business?.services || []),
    [custom, setCustom] = useState('');
  const options = [...new Set([...services, ...chosen])];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await onSave({
      action: 'save_business',
      name: f.get('name'),
      email: f.get('email'),
      phone: f.get('phone'),
      services: chosen,
    });
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <div className="form-grid">
        <Field label="Business name">
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={business?.name}
            placeholder="Your business name"
          />
        </Field>
        <Field label="Business email">
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={business?.email}
            placeholder="hello@yourbusiness.com"
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={business?.phone}
          />
        </Field>
        <div className="setting-note">
          <Building2 size={19} />
          <span>Your clients and bookings belong to this workspace.</span>
        </div>
      </div>
      <div>
        <h3>What do you offer?</h3>
        <p className="muted">
          Choose all that apply. You can change these later.
        </p>
      </div>
      <div className="category-grid">
        {options.map((s) => (
          <label
            key={s}
            className={`check-card ${chosen.includes(s) ? 'selected' : ''}`}
          >
            <Checkbox
              checked={chosen.includes(s)}
              onCheckedChange={(checked) =>
                setChosen(
                  checked ? [...chosen, s] : chosen.filter((x) => x !== s),
                )
              }
            />
            <span>{s}</span>
          </label>
        ))}
      </div>
      <div className="custom-service">
        <input
          aria-label="Custom service name"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={70}
          placeholder="Add another service"
        />
        <button
          type="button"
          className="secondary"
          disabled={!custom.trim() || chosen.includes(custom.trim())}
          onClick={() => {
            setChosen([...chosen, custom.trim()]);
            setCustom('');
          }}
        >
          <Plus size={16} />
          Add
        </button>
      </div>
      <div className="form-footer">
        <span>{chosen.length} services selected · USD pricing</span>
        <button className="primary" disabled={busy || !chosen.length}>
          {busy ? 'Saving…' : business ? 'Save business' : 'Create workspace'}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
export function EventForm({
  item,
  packages,
  onSave,
  busy,
  data,
  preview = false,
  packageLinkId = '',
  defaults = {},
}: {
  defaults?: Partial<EventRecord>;
  preview?: boolean;
  packageLinkId?: string;
  item?: EventRecord;
  packages: PackageRecord[];
  onSave: Save;
  busy: boolean;
  data: Data;
}) {
  const [ids, setIds] = useState<string[]>(
    item?.items.map((p) => p.id) ||
      (packages.some(
        (p) => p.id === packageLinkId && p.settings?.status !== 'Disabled',
      )
        ? [packageLinkId]
        : []),
  );
  const [eventDate, setEventDate] = useState(item?.date || defaults.date || '');
  const [venue, setVenue] = useState(item?.venue ?? defaults.venue ?? '');
  const [selection, setSelection] = useState<Record<string, PackageSelection>>(
    Object.fromEntries(
      (item?.items || []).map((p) => [
        p.id,
        { minutes: p.minutes, units: p.units },
      ]),
    ),
  );
  const [eventTime, setEventTime] = useState(item?.time || defaults.time || '');
  const initialStatus = preview ? 'lead' : defaults.status === 'confirmed' ? 'confirmed' : defaults.status === 'proposal' ? 'proposal' : 'lead';
  const creatingBooking = !item && initialStatus === 'confirmed';
  const pickingClient = !item && !preview && initialStatus === 'proposal';
  const staff = (data.resources || []).filter(r => r.kind === 'staff' && !r.archived && r.data.staffRole !== false && r.data.staffRole !== 0);
  const choices = packages
    .filter(
      (p) =>
        item?.items.some((x) => x.id === p.id) ||
        (p.settings?.status !== 'Disabled' &&
          (!preview ||
            p.settings?.status === 'Public' ||
            p.id === packageLinkId)),
    )
    .map((p) => item?.items.find((x) => x.id === p.id) || p);
  let calculated: LineItem[] = [],
    pricingError = '';
  try {
    calculated = choices
      .filter((p) => ids.includes(p.id))
      .map((p) => pricePackage(p, selection[p.id]));
  } catch (e) {
    pricingError =
      e instanceof Error ? e.message : 'Invalid package selection.';
  }
  const selectedSettings = calculated
    .map((p) => p.packageSettings)
    .filter(Boolean);
  const timed = selectedSettings.some((s) => s?.dateMode === 'Date & Time');
  const constrained = selectedSettings.filter(
    (s) => s?.dateMode === 'Date & Time' && s.picker !== 'Minimal',
  );
  const startOptions = Array.from({ length: 1440 }, (_, m) => m)
    .filter((m) => {
      if (!constrained.length) return false;
      const t =
        String(Math.floor(m / 60)).padStart(2, '0') +
        ':' +
        String(m % 60).padStart(2, '0');
      try {
        validatePackageSchedule(calculated, eventDate || '2027-01-02', t, '');
      } catch {
        return false;
      }
      return true;
    })
    .map(
      (m) =>
        String(Math.floor(m / 60)).padStart(2, '0') +
        ':' +
        String(m % 60).padStart(2, '0'),
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await onSave({
      action: 'save_event',
      id: item?.id,
      initialStatus,
      staffIds: creatingBooking ? f.getAll('staffIds') : undefined,
      title: f.get('title'),
      brandId: f.get('brandId') ?? item?.operations?.brand?.id ?? '',
      client: f.get('client'),
      email: f.get('email'),
      phone: f.get('phone'),
      date: f.get('date'),
      time: f.get('time'),
      venue: f.get('venue'),
      source: preview
        ? [...new Set(selectedSettings.map((s) => s?.bookingMode))].join(', ')
        : f.get('source'),
      notes: f.get('notes'),
      follow_up: f.get('follow_up'),
      deposit: Math.round(Number(f.get('deposit') || 0) * 100),
      packageIds: ids,
      packageSelections: selection,
      bookingPreview: preview,
      packageLinkId: preview ? packageLinkId : undefined,
      bookingAnswers:JSON.parse(String(f.get('bookingAnswers')||'{}')),
      addonIds: JSON.parse(String(f.get('addonIds') || '[]')),
      addonQuantities: JSON.parse(String(f.get('addonQuantities') || '{}')),
      extraPackageIds: JSON.parse(String(f.get('extraPackageIds') || '{}')),
      pricingContext: JSON.parse(String(f.get('pricingContext') || '{}')),
      backdropId: f.get('backdropId'),
      discountId: f.get('discountId'),
      miles: Number(f.get('miles') || 0),
    });
  }
  return (
    <form onSubmit={submit} className="form-stack">
      {creatingBooking && <p className="capability-note">This creates a confirmed booking and reserves availability for the selected packages.</p>}
      {(brandRecords(data.resources || []).length > 0 || item?.operations?.brand) && <Field label="Brand">
        <select name="brandId" defaultValue={item?.operations?.brand?.id || ''}>
          <option value="">{data.business?.name} (primary brand)</option>
          {brandRecords(data.resources || []).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          {item?.operations?.brand && !brandRecords(data.resources || []).some(r=>r.id===item.operations?.brand?.id) && <option value={item.operations.brand.id}>{item.operations.brand.name} (archived)</option>}
        </select>
      </Field>}
      <Field label="Event title">
        <input
          name="title"
          required
          maxLength={150}
          defaultValue={item?.title ?? defaults.title}
          placeholder="e.g. Morgan & Alex’s wedding"
        />
      </Field>
      {pickingClient && <ClientPicker data={data} defaults={defaults} />}
      <div className="form-grid">
        {!pickingClient && <><Field label="Client name">
          <input
            name="client"
            required
            maxLength={120}
            defaultValue={item?.client ?? defaults.client}
          />
        </Field>
        <Field label="Client email">
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={item?.email ?? defaults.email}
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={item?.phone ?? defaults.phone}
          />
        </Field></>}
        <Field label="Lead source (optional)">
          <input
            name="source"
            maxLength={80}
            defaultValue={item?.source ?? defaults.source}
            placeholder="Google, referral, website…"
          />
        </Field>
        <Field label="Event date">
          <input
            name="date"
            type="date"
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </Field>
        {(!ids.length || timed || !selectedSettings.length) && (
          <Field label="Start time (required before confirmation)">
            {constrained.length ? (
              <Select
                value={eventTime}
                onValueChange={(v) => setEventTime(String(v))}
              >
                <SelectTrigger aria-label="Start time">
                  <SelectValue>{eventTime || 'Choose start time'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {startOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            )}
          </Field>
        )}
        <input
          type="hidden"
          name="time"
          value={timed || !selectedSettings.length ? eventTime : ''}
        />
      </div>
      <VenueAutocomplete label="Venue / location (optional)" name="venue" maxLength={1000}
        value={venue} onChange={setVenue} venues={savedVenues(data.resources || [])}/>
      <fieldset>
        <legend>Packages for this event</legend>
        <p className="muted">Combine services in one event.</p>
        <div className="package-choices">
          {choices.length ? (
            choices.map((p) => (
              <label
                key={p.id}
                className={`check-card ${ids.includes(p.id) ? 'selected' : ''}`}
              >
                {'images' in p && p.images?.[0] && (
                  <img
                    className="package-choice-image"
                    src={imageUrl(p.images[0].id)}
                    alt={p.name}
                  />
                )}
                <Checkbox
                  checked={ids.includes(p.id)}
                  disabled={item?.status === 'confirmed'}
                  onCheckedChange={(checked) =>
                    setIds(
                      checked ? [...ids, p.id] : ids.filter((x) => x !== p.id),
                    )
                  }
                />
                <span>
                  <strong>
                    {preview && 'settings' in p && !p.settings?.showTitle
                      ? p.service
                      : p.name}
                  </strong>
                  {'settings' in p && p.settings?.subheader && (
                    <small>{p.settings.subheader}</small>
                  )}
                  <small>
                    {p.service} · {p.duration}
                  </small>
                </span>
                <b>{money(p.price)}</b>
              </label>
            ))
          ) : (
            <p className="muted">
              You can save this lead now and add packages after creating your
              offering.
            </p>
          )}
        </div>
      </fieldset>
      {choices
        .filter((p) => ids.includes(p.id))
        .map((p) => {
          const s = packageSettings(
            'settings' in p
              ? p.settings
              : 'packageSettings' in p
                ? p.packageSettings
                : undefined,
            p.duration,
          );
          const lengths = durationRules(s),
            units = unitBounds(s),
            minutes = selection[p.id]?.minutes ?? lengths.included;
          const changeDuration = (minutes: number) =>
            setSelection((v) => ({
              ...v,
              [p.id]: { ...v[p.id], minutes },
            }));
          if (!('settings' in p) && !('packageSettings' in p)) return null;
          return (
            <fieldset key={p.id}>
              <legend>{p.name} · duration & quantity</legend>
              <div className="form-grid">
                {lengths.dayBased ? (
                  <Field label={`Duration in days (${lengths.min / 1440}–${lengths.max / 1440})`}>
                    <PackageNumberInput
                      aria-label={p.name + ' duration in days'}
                      required
                      min={lengths.min / 1440}
                      max={lengths.max / 1440}
                      step={1}
                      disabled={item?.status === 'confirmed'}
                      value={minutes / 1440}
                      onValueChange={(days) => changeDuration(days * 1440)}
                    />
                  </Field>
                ) : (
                  <div className="field">
                    <span>Duration ({packageDurationLabel(s, lengths.min)}{lengths.max !== lengths.min && `–${packageDurationLabel(s, lengths.max)}`})</span>
                    <div className="event-duration-inputs">
                      <Field label="Hours">
                        <PackageNumberInput
                          aria-label={p.name + ' duration hours'}
                          required
                          min={Math.floor(lengths.min / 60)}
                          max={Math.floor(lengths.max / 60)}
                          step={1}
                          disabled={item?.status === 'confirmed'}
                          value={Math.floor(minutes / 60)}
                          onValueChange={(hours) => {
                            if (Number.isInteger(hours) && hours >= 0)
                              changeDuration(hours * 60 + minutes % 60);
                          }}
                        />
                      </Field>
                      <Field label="Minutes">
                        <PackageNumberInput
                          aria-label={p.name + ' duration minutes'}
                          required
                          min={0}
                          max={59}
                          step={1}
                          disabled={item?.status === 'confirmed'}
                          value={minutes % 60}
                          onValueChange={(remainder) => {
                            if (Number.isInteger(remainder) && remainder >= 0 && remainder <= 59)
                              changeDuration(Math.floor(minutes / 60) * 60 + remainder);
                          }}
                        />
                      </Field>
                    </div>
                    {lengths.min !== lengths.max && <small>Booking increments: {packageDurationLabel(s, lengths.increment)}.</small>}
                  </div>
                )}
                {s.unitMode !== 'None' && (
                  <Field label={'Number of ' + s.unitLabel + 's'}>
                    <input
                      aria-label={p.name + ' units'}
                      type="number"
                      min={units.min}
                      max={units.max}
                      step={1}
                      disabled={item?.status === 'confirmed'}
                      value={selection[p.id]?.units ?? units.min}
                      onChange={(e) =>
                        setSelection((v) => ({
                          ...v,
                          [p.id]: { ...v[p.id], units: Number(e.target.value) },
                        }))
                      }
                    />
                  </Field>
                )}
              </div>
              <p className="muted">
                {lengths.dayBased && s.extraDays
                  ? 'Extra days: ' +
                    money(Math.round(s.dailyRate * 100)) +
                    '/day. '
                  : s.extraHours && !lengths.dayBased
                    ? 'Extra time: ' +
                      money(Math.round(s.extraRate * 100)) +
                      '/hour. '
                    : ''}
                {s.requireBackdrop
                  ? 'Backdrop ' +
                    (s.allowSkipBackdrop
                      ? 'optional'
                      : 'required before confirmation') +
                    '. '
                  : ''}
                {s.requiredStaff ? s.requiredStaff + ' staff required. ' : ''}
                {preview ? s.bookingMode : ''}
              </p>
            </fieldset>
          );
        })}
      {pricingError && (
        <p className="error" role="alert">
          {pricingError}
        </p>
      )}
      <EventExtras
        data={data}
        item={item}
        ids={ids}
        date={eventDate}
        pricedItems={calculated}
      />
      {creatingBooking && <fieldset>
        <legend>Assign staff</legend>
        <p className="muted">{calculated.reduce((n, p) => n + (p.packageSettings?.requiredStaff || 0), 0) || 'No'} staff required by these packages. Staff availability is checked when you create the booking.</p>
        <div className="sales-checks">{staff.map(person => <label className="check" key={person.id}><input type="checkbox" name="staffIds" value={person.id} />{person.name}</label>)}</div>
        {!staff.length && <p className="muted">Add staff in Staff &amp; user accounts if your package requires an assignment.</p>}
      </fieldset>}
      <div className="form-grid">
        <Field label="Follow-up date (optional)">
          <input
            name="follow_up"
            type="date"
            defaultValue={item?.follow_up ?? defaults.follow_up}
          />
        </Field>
      </div>
      <Field label="Private notes">
        <textarea
          name="notes"
          maxLength={5000}
          rows={3}
          defaultValue={item?.notes ?? defaults.notes}
          placeholder="Requirements and details for your team"
        />
      </Field>
      <div className="form-footer">
        <span>Saving does not send a message.</span>
        <button className="primary" disabled={busy || Boolean(pricingError)}>
          {busy
            ? 'Saving…'
            : item
              ? 'Save changes'
              : creatingBooking
                ? 'Create booking'
                : initialStatus === 'proposal'
                ? 'Create proposal'
                : 'Create lead'}
        </button>
      </div>
    </form>
  );
}
