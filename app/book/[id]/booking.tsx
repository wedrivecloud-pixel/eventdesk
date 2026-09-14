'use client';
import { BrandSocialLinks } from '@/app/brand-social-links';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CalendarDays,
  Clock,
  Mail,
  Phone,
  Sparkles,
  Send,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { durationLabel } from '@/lib/package-config';
import type {
  PublicBooking,
  AvailableSlot,
  BookingInput,
  PublicQuote,
  BookingContact,
} from '@/lib/public-booking';
import './booking.css';
import { QuestionInput } from '../../question-input';
import {BookingVenueFields,BookingVenueSummary} from '../../booking-venue';
import {emptyBookingVenue,checkedBookingVenue} from '@/lib/booking-venue';
const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    n / 100,
  );
const prettyTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const prettyDay = (d: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(d + 'T12:00:00Z'));
function Choice({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="cb-field">
      <label id={id + '-label'}>{label}</label>
      <Select
        value={value || null}
        onValueChange={(v) => onChange(String(v ?? ''))}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-labelledby={id + '-label'}
          className="w-full"
        >
          <SelectValue placeholder="Choose an option">
            {options.find((x) => x.value === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export default function CustomerBooking({
  initial,
  catalogHref,
  requestedDate = '',
}: {
  initial: PublicBooking;
  catalogHref: string;
  requestedDate?: string;
}) {
  const { business, package: p } = initial;
  const dayBased = p.dateMode === 'Date Only' && p.durationUnit === 'Days',
    fixedSlots =
      p.dateMode === 'Date & Time' &&
      p.picker === 'Predefined slots' &&
      p.predefinedSlots.length > 0;
  const lengthLabel = (n: number) =>
    dayBased ? n / 1440 + (n === 1440 ? ' day' : ' days') : durationLabel(n);
  const endDate = (date: string, minutes: number) => {
    if (!date) return '';
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + minutes / 1440 - 1);
    return d.toISOString().slice(0, 10);
  };
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [photo, setPhoto] = useState(p.images[0]?.id || '');
  const [contact, setContact] = useState<BookingContact>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    title: '',
    venue: '',
    notes: '',
  });
  const [venueDetails,setVenueDetails]=useState(emptyBookingVenue),[venueLater,setVenueLater]=useState(false),[venueBusy,setVenueBusy]=useState(false);
  const [selection, setSelection] = useState<BookingInput>({
    date: requestedDate>=initial.earliestDate&&requestedDate<=initial.latestDate?requestedDate:'',
    time: '',
    minutes: p.includedMinutes,
    units: p.minUnits,
    addonIds: [],
    backdropId: '',
    discountCode: '',
  });
  const [availability, setAvailability] = useState<{
    loading: boolean;
    available: boolean;
    times: string[];
    slots: AvailableSlot[];
    error: string;
  }>({ loading: false, available: false, times: [], slots: [], error: '' });
  // Predefined choices already carry their duration. Selecting one must not
  // clear and remount the list while a redundant availability request runs.
  const availabilityMinutes = fixedSlots
    ? p.includedMinutes
    : selection.minutes;
  const [quote, setQuote] = useState<PublicQuote | null>(null),
    [acknowledged, setAcknowledged] = useState(false),
    [consented, setConsented] = useState(false),
    [honeypot, setHoneypot] = useState(''),
    [receipt, setReceipt] = useState('');
  const requestId = useRef(''),
    inFlight = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    firstRender = useRef(true);
  useEffect(() => {
    requestId.current = crypto.randomUUID();
  }, []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step, receipt]);
  useEffect(() => {
    if (!selection.date) {
      setAvailability({
        loading: false,
        available: false,
        times: [],
        slots: [],
        error: '',
      });
      return;
    }
    const abort = new AbortController();
    setAvailability({
      loading: true,
      available: false,
      times: [],
      slots: [],
      error: '',
    });
    fetch(
      '/api/booking?' +
        new URLSearchParams({
          package: p.id,
          brand: initial.brandId || '',
          date: selection.date,
          minutes: String(availabilityMinutes),
        }),
      { signal: abort.signal, cache: 'no-store' },
    )
      .then(async (r) => {
        const d = (await r.json()) as {
          available: boolean;
          times: string[];
          slots: AvailableSlot[];
          error?: string;
        };
        if (!r.ok) throw Error(d.error || 'Unable to check this date.');
        return d;
      })
      .then((d) => {
        setAvailability({
          loading: false,
          available: d.available,
          times: d.times,
          slots: d.slots || [],
          error: d.available
            ? ''
            : 'No start times are available for this duration. Please choose another date or duration.',
        });
        setSelection((s) => ({
          ...s,
          time: d.times.includes(s.time) ? s.time : '',
        }));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setAvailability({
            loading: false,
            available: false,
            times: [],
            slots: [],
            error: e.message || 'Unable to check availability.',
          });
      });
    return () => abort.abort();
  }, [p.id, selection.date, availabilityMinutes]);
  function change<K extends keyof BookingInput>(
    key: K,
    value: BookingInput[K],
  ) {
    setSelection((s) => ({
      ...s,
      [key]: value,
      ...(key === 'date' || key === 'minutes' ? { time: '' } : {}),
    }));
    setQuote(null);
    setAcknowledged(false);
    setError('');
  }
  const field = (
    key: keyof BookingContact,
    label: string,
    type = 'text',
    max = 120,
    required = true,
  ) => (
    <label className="cb-field">
      <span>
        {label}
        {!required ? ' (optional)' : ''}
      </span>
      <input
        type={type}
        value={contact[key]}
        required={required}
        maxLength={max}
        autoComplete={
          (
            {
              firstName: 'given-name',
              lastName: 'family-name',
              email: 'email',
              phone: 'tel',
            } as Record<string, string>
          )[key] || 'off'
        }
        onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
      />
    </label>
  );
  const durations = [
    ...new Set([
      ...Array.from(
        { length: Math.floor((p.maxMinutes - p.minMinutes) / p.increment) + 1 },
        (_, i) => p.minMinutes + i * p.increment,
      ),
      p.includedMinutes,
    ]),
  ].sort((a, b) => a - b);
  async function advance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (inFlight.current) return;
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1 && (!availability.available || availability.loading)) {
      setError('Choose an available event date.');
      return;
    }
    if (step === 1 && p.dateMode !== 'Date Only' && !selection.time) {
      setError('Choose a start time.');
      return;
    }
    if (
      step === 1 &&
      p.requireBackdrop &&
      !p.allowSkipBackdrop &&
      !selection.backdropId
    ) {
      setError('Choose a backdrop for this package.');
      return;
    }
    if (
      step === 3 &&
      (!acknowledged || (initial.privacy?.required && !consented))
    ) {
      setError('Please acknowledge that your request requires approval.');
      return;
    }
    if(step===1){setStep(2);return;}
    inFlight.current = true;
    setBusy(true);
    try {
      const submittedVenue=venueLater?null:checkedBookingVenue(venueDetails);
      const r = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: step === 2 ? 'quote' : 'submit',
          packageId: p.id,
          brandId: initial.brandId || '',
          ...selection,
          ...(step === 3
            ? {
                ...contact,
                venueDetails:submittedVenue,
                acknowledged,
                consented,
                companyWebsite: honeypot,
                requestId: requestId.current,
                quoteToken: quote?.token,
              }
            : {}),
        }),
      });
      const d = (await r.json()) as PublicQuote & {
        error?: string;
        code?: string;
        reference: string;
      };
      if (!r.ok) {
        if (d.code === 'QUOTE_CHANGED') {
          setStep(1);
          setQuote(null);
          setAcknowledged(false);
        }
        throw Error(
          d.error || 'Unable to send your request. Please try again.',
        );
      }
      if (step === 2) {
        setQuote(d);
        setStep(3);
      } else setReceipt(d.reference);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to connect. Please try again.',
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  const img = (id: string) =>
    '/api/booking/image?' + new URLSearchParams({ package: p.id, image: id });
  return (
    <div
      className="client-booking"
      style={
        {
          '--cb-brand': business.color,
          background: initial.presentation?.background || undefined,
        } as CSSProperties
      }
    >
      <header className="cb-header">
        <a href={'/book/' + encodeURIComponent(p.id)} className="cb-brand">
          {business.hasLogo ? (
            <img
              src={
                business.logoUrl || '/api/booking/image?' +
                new URLSearchParams({ package: p.id, logo: '1' })
              }
              alt=""
            />
          ) : (
            <span className="cb-monogram">{business.name.slice(0, 1)}</span>
          )}
          <span>{business.name}</span>
        </a>
        <span className="cb-header-note">
          {initial.presentation?.headline || 'Your event starts here'}
        </span>
      </header>
      <main className="cb-layout">
        <section className="cb-main">
          {initial.presentation?.image && (
            <img
              src={initial.presentation.image}
              alt=""
              style={{
                width: '100%',
                maxHeight: 240,
                objectFit: 'cover',
                borderRadius: 12,
              }}
            />
          )}
          {initial.presentation?.subheading && (
            <p>{initial.presentation.subheading}</p>
          )}
          {!receipt && (
            <a className="cb-browse-all" href={catalogHref}>
              <ArrowLeft size={15} /> View all packages
            </a>
          )}
          {receipt ? (
            <div className="cb-success">
              <span className="cb-success-icon">
                <Check size={32} />
              </span>
              <p className="cb-eyebrow">Request received</p>
              <h1 ref={heading} tabIndex={-1}>
                Thanks, {contact.firstName}.
              </h1>
              <p>
                Your request for <strong>{p.name}</strong> on{' '}
                <strong>
                  {prettyDay(selection.date)}
                  {dayBased && selection.minutes > 1440
                    ? ' – ' +
                      prettyDay(endDate(selection.date, selection.minutes))
                    : ''}
                </strong>{' '}
                has been sent to {business.name} for approval.
              </p>
              <div className="cb-callout">
                <Clock size={20} />
                <div>
                  <strong>Waiting for business approval</strong>
                  <p>
                    Your date is not reserved yet. The business will contact you
                    at {contact.email} to confirm availability and the final
                    price. No payment has been collected.
                  </p>
                </div>
              </div>
              <p className="cb-reference">
                Request reference
                <br />
                <code>{receipt}</code>
              </p>
              <p className="cb-muted">Save this reference for your records.</p>
            </div>
          ) : (
            <>
              <ol className="cb-steps" aria-label="Booking progress">
                {['Contact', 'Event details', 'Venue', 'Review'].map((label, i) => (
                  <li
                    key={label}
                    aria-current={step === i ? 'step' : undefined}
                    className={step >= i ? 'active' : ''}
                  >
                    <span>{step > i ? <Check size={14} /> : i + 1}</span>
                    {label}
                  </li>
                ))}
              </ol>
              <p className="cb-eyebrow">
                {step === 0
                  ? 'Let’s make it happen'
                  : step === 1
                    ? 'Make it yours'
                    : step===2?'Where it all happens':'One last look'}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {
                  [
                    'How can we reach you?',
                    'Tell us about your event.',
                    'Choose your venue.',
                    'Review your request.',
                  ][step]
                }
              </h1>
              <p className="cb-intro">
                {
                  [
                    'Share your contact details so ' +
                      business.name +
                      ' can follow up with you.',
                    'Choose your preferred date, time and extras. The business will confirm availability.',
                    'Search for your venue or enter its address. Check the details before continuing.',
                    'Check your details and estimate before sending this request for approval.',
                  ][step]
                }
              </p>
              <form onSubmit={advance}>
                <div className="cb-honeypot" aria-hidden="true">
                  <label>
                    Company website
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </label>
                </div>
                {step === 0 && (
                  <>
                    <div className="cb-grid">
                      {field('firstName', 'First name', 'text', 60)}
                      {field('lastName', 'Last name', 'text', 60)}
                    </div>
                    {field('email', 'Email address', 'email', 200)}
                    {field('phone', 'Phone number', 'tel', 40)}
                    <p className="cb-muted">
                      Your details are shared with {business.name} to respond to
                      this request.
                    </p>
                  </>
                )}
                {step === 1 && (
                  <>
                    {field('title', 'Event name', 'text', 150)}
                    <div className="cb-grid">
                      <label className="cb-field">
                        <span>{dayBased ? 'Start date' : 'Event date'}</span>
                        <input
                          type="date"
                          required
                          min={initial.earliestDate}
                          max={initial.latestDate}
                          value={selection.date}
                          onChange={(e) => change('date', e.target.value)}
                        />
                      </label>
                      {dayBased ? (
                        <label className="cb-field">
                          <span>End date (inclusive)</span>
                          <input
                            type="date"
                            required
                            disabled={!selection.date}
                            min={endDate(selection.date, p.minMinutes)}
                            max={
                              endDate(selection.date, p.maxMinutes) <
                              initial.latestDate
                                ? endDate(selection.date, p.maxMinutes)
                                : initial.latestDate
                            }
                            value={endDate(selection.date, selection.minutes)}
                            onChange={(e) => {
                              if (e.target.value)
                                change(
                                  'minutes',
                                  (Math.round(
                                    (Date.parse(e.target.value + 'T12:00:00Z') -
                                      Date.parse(
                                        selection.date + 'T12:00:00Z',
                                      )) /
                                      86400000,
                                  ) +
                                    1) *
                                    1440,
                                );
                            }}
                          />
                          <small>{lengthLabel(selection.minutes)}</small>
                        </label>
                      ) : (
                        !fixedSlots && (
                          <Choice
                            id="cb-duration"
                            label="Duration"
                            value={String(selection.minutes)}
                            onChange={(v) => change('minutes', Number(v))}
                            options={durations.map((n) => ({
                              value: String(n),
                              label: lengthLabel(n),
                            }))}
                          />
                        )
                      )}
                    </div>
                    {p.unitMode !== 'None' && (
                      <label className="cb-field">
                        <span>Number of {p.unitLabel}(s)</span>
                        <input
                          type="number"
                          required
                          min={p.minUnits}
                          max={p.maxUnits}
                          step={1}
                          value={selection.units}
                          onChange={(e) =>
                            change('units', Number(e.target.value))
                          }
                        />
                      </label>
                    )}
                    {p.dateMode !== 'Date Only' &&
                      (p.picker === 'Minimal' ? (
                        <label className="cb-field">
                          <span>
                            Preferred start time ·{' '}
                            {business.timezone.replaceAll('_', ' ')}
                          </span>
                          <input
                            type="time"
                            step={60}
                            required
                            disabled={
                              !availability.available || availability.loading
                            }
                            value={selection.time}
                            onChange={(e) => change('time', e.target.value)}
                          />
                          <small>
                            {availability.times.length > 0
                              ? 'Available starts: ' +
                                prettyTime(availability.times[0]) +
                                ' – ' +
                                prettyTime(availability.times.at(-1)!)
                              : ''}
                          </small>
                        </label>
                      ) : (
                        <Choice
                          id="cb-time"
                          label={
                            (fixedSlots
                              ? 'Choose a time slot'
                              : 'Preferred start time') +
                            ' · ' +
                            business.timezone.replaceAll('_', ' ')
                          }
                          value={selection.time}
                          options={availability.slots.map((slot) => ({
                            value: slot.time,
                            label: fixedSlots
                              ? slot.label + ' · ' + lengthLabel(slot.minutes)
                              : prettyTime(slot.time),
                          }))}
                          onChange={(v) => {
                            const slot = availability.slots.find(
                              (slot) => slot.time === v,
                            );
                            if (fixedSlots && slot) {
                              setSelection((s) => ({
                                ...s,
                                time: v,
                                minutes: slot.minutes,
                              }));
                              setQuote(null);
                              setAcknowledged(false);
                              setError('');
                            } else change('time', v);
                          }}
                          disabled={
                            !availability.available || availability.loading
                          }
                        />
                      ))}
                    {availability.loading && (
                      <p role="status" className="cb-muted">
                        Checking available times…
                      </p>
                    )}
                    {availability.error && (
                      <p role="alert" className="cb-error">
                        {availability.error}
                      </p>
                    )}
                    {initial.addons.length > 0 && (
                      <fieldset className="cb-extras">
                        <legend>Add a little extra</legend>
                        {initial.addons.map((a) => {
                          const included =
                            p.includedAddonIds.includes(a.id) || a.included;
                          const forced = p.includedAddonIds.includes(a.id);
                          const selected =
                            forced || selection.addonIds.includes(a.id);
                          return (
                            <div key={a.id} className="cb-extra">
                              <Checkbox
                                checked={
                                  forced || selection.addonIds.includes(a.id)
                                }
                                disabled={forced}
                                aria-label={'Add ' + a.name}
                                onCheckedChange={(checked) =>
                                  change(
                                    'addonIds',
                                    checked
                                      ? [...selection.addonIds, a.id]
                                      : selection.addonIds.filter(
                                          (id) => id !== a.id,
                                        ),
                                  )
                                }
                              />
                              <span>
                                <strong>{a.name}</strong>
                                {a.images?.[0] && (
                                  <img
                                    width={96}
                                    alt={a.name}
                                    src={
                                      '/api/public-media?' +
                                      new URLSearchParams({
                                        business: business.id,
                                        item: a.id,
                                        id: a.images[0],
                                        package: p.id,
                                      })
                                    }
                                  />
                                )}
                                {a.description && (
                                  <small>{a.description}</small>
                                )}
                              </span>
                              <b>
                                {included
                                  ? 'First unit included'
                                  : money(a.price)}
                                {a.pricingMethod === 'Multiply by package hours'
                                  ? ' / hour'
                                  : a.pricingMethod ===
                                      'Multiply by package days'
                                    ? ' / day'
                                    : ''}
                              </b>
                              {selected && a.maxQuantity > 1 && (
                                <label>
                                  Quantity for {a.name}
                                  <input
                                    type="number"
                                    min={1}
                                    max={a.maxQuantity}
                                    step={1}
                                    value={
                                      selection.addonQuantities?.[a.id] || 1
                                    }
                                    onChange={(e) =>
                                      change('addonQuantities', {
                                        ...selection.addonQuantities,
                                        [a.id]: Number(e.target.value),
                                      })
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </fieldset>
                    )}
                    {initial.backdrops.length > 0 && (
                      <Choice
                        id="cb-backdrop"
                        label={
                          'Backdrop' +
                          (p.requireBackdrop && !p.allowSkipBackdrop
                            ? ' (required)'
                            : ' (optional)')
                        }
                        value={selection.backdropId || 'none'}
                        onChange={(v) =>
                          change('backdropId', v === 'none' ? '' : v)
                        }
                        options={[
                          { value: 'none', label: 'Choose a backdrop' },
                          ...initial.backdrops.map((b) => ({
                            value: b.id,
                            label:
                              b.name +
                              ' · ' +
                              (b.included ? 'Included' : money(b.price)),
                          })),
                        ]}
                      />
                    )}
                    {initial.questions?.map((q) => (
                      <QuestionInput
                        key={q.id}
                        field={q}
                        value={selection.answers?.[q.id] || ''}
                        answers={selection.answers}
                        uploadContext={{ packageId: p.id }}
                        onChange={(v) =>
                          change('answers', { ...selection.answers, [q.id]: v })
                        }
                      />
                    ))}
                    <label className="cb-field">
                      <span>Discount code (optional)</span>
                      <input
                        maxLength={80}
                        value={selection.discountCode}
                        onChange={(e) => change('discountCode', e.target.value)}
                      />
                    </label>
                    <label className="cb-field">
                      <span>Anything else we should know? (optional)</span>
                      <textarea
                        rows={4}
                        maxLength={3000}
                        value={contact.notes}
                        onChange={(e) =>
                          setContact({ ...contact, notes: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {step===2&&<>
                  <label className="cb-consent cb-venue-later"><Checkbox checked={venueLater} onCheckedChange={v=>{setVenueLater(v===true);setVenueBusy(false);}}/>
                    <span>I haven’t chosen a venue yet.</span></label>
                  {!venueLater&&<BookingVenueFields value={venueDetails} onChange={setVenueDetails} packageId={p.id} onBusyChange={setVenueBusy}/>}
                </>}
                {step === 3 && quote && (
                  <>
                    <div className="cb-review">
                      <div>
                        <p className="cb-eyebrow">Your event</p>
                        <h2>{contact.title}</h2>
                        <p>
                          {prettyDay(selection.date)}
                          {dayBased && selection.minutes > 1440
                            ? ' – ' +
                              prettyDay(
                                endDate(selection.date, selection.minutes),
                              )
                            : ''}
                          {selection.time
                            ? ' · ' + prettyTime(selection.time)
                            : ''}
                        </p>
                        <p>
                          {quote.duration}
                          {selection.time
                            ? ' · ' + business.timezone.replaceAll('_', ' ')
                            : ''}
                        </p>
                      </div>
                      <div>
                        <p className="cb-eyebrow">Contact</p>
                        <strong>
                          {contact.firstName} {contact.lastName}
                        </strong>
                        <p>{contact.email}</p>
                        <p>{contact.phone}</p>
                      </div>
                    </div>
                    <BookingVenueSummary venue={venueLater?null:venueDetails}/>
                    <button type="button" className="cb-edit-venue" onClick={()=>{setStep(2);setAcknowledged(false);setError('');}}>Edit venue address</button>
                    {contact.notes && (
                      <div className="cb-message">
                        <strong>Your message</strong>
                        <p>{contact.notes}</p>
                      </div>
                    )}
                    <div className="cb-estimate">
                      <h2>Your estimate</h2>
                      <dl>
                        <div>
                          <dt>{p.name}</dt>
                          <dd>{money(quote.packagePrice)}</dd>
                        </div>
                        {quote.extras.map((x, i) => (
                          <div key={i}>
                            <dt>{x.name}</dt>
                            <dd>
                              {x.included && !x.price
                                ? 'Included'
                                : money(x.price)}
                            </dd>
                          </div>
                        ))}
                        {quote.adjustment !== 0 && (
                          <div>
                            <dt>Date pricing adjustment</dt>
                            <dd>{money(quote.adjustment)}</dd>
                          </div>
                        )}
                        {quote.discount > 0 && (
                          <div>
                            <dt>Discount</dt>
                            <dd>−{money(quote.discount)}</dd>
                          </div>
                        )}
                        {quote.tax > 0 && (
                          <div>
                            <dt>{quote.taxLabel}</dt>
                            <dd>{money(quote.tax)}</dd>
                          </div>
                        )}
                        {quote.travel > 0 && (
                          <div>
                            <dt>Base travel fee</dt>
                            <dd>{money(quote.travel)}</dd>
                          </div>
                        )}
                        <div className="cb-total">
                          <dt>Estimated total</dt>
                          <dd>{money(quote.total)}</dd>
                        </div>
                      </dl>
                      <p className="cb-muted">
                        Final availability and price, including any additional
                        travel charges, are confirmed by the business.
                      </p>
                      {quote.deposit > 0 && (
                        <p className="cb-muted">
                          Estimated deposit after approval:{' '}
                          {money(quote.deposit)}. Nothing is due on this page.
                        </p>
                      )}
                    </div>
                    {quote.terms && (
                      <details className="cb-terms">
                        <summary>Booking terms</summary>
                        <p>{quote.terms}</p>
                      </details>
                    )}
                    {initial.privacy?.required && (
                      <label className="cb-acknowledgement">
                        <Checkbox
                          checked={consented}
                          onCheckedChange={(v) => setConsented(v === true)}
                        />
                        <span>
                          {initial.privacy.text ||
                            'I agree to the privacy policy.'}{' '}
                          {initial.privacy.url && (
                            <a
                              href={initial.privacy.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Privacy policy
                            </a>
                          )}
                        </span>
                      </label>
                    )}
                    {initial.privacy?.sms && (
                      <p className="cb-muted">{initial.privacy.sms}</p>
                    )}
                    <label className="cb-acknowledgement">
                      <Checkbox
                        checked={acknowledged}
                        onCheckedChange={(v) => setAcknowledged(v === true)}
                      />
                      <span>
                        I understand this is a request for approval. My date is
                        not reserved until {business.name} confirms it, and no
                        payment is collected here.
                      </span>
                    </label>
                  </>
                )}
                {error && (
                  <p className="cb-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="cb-actions">
                  {step > 0 && (
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setStep(step - 1);
                        setError('');
                        setAcknowledged(false);
                      }}
                    >
                      <ArrowLeft size={16} />
                      Back
                    </button>
                  )}
                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      busy ||
                      (step === 1 &&
                        (!availability.available || availability.loading)) ||
                      (step===2&&venueBusy) ||
                      (step === 3 &&
                        (!acknowledged ||
                          (initial.privacy?.required && !consented)))
                    }
                  >
                    {busy
                      ? step === 2
                        ? 'Calculating…'
                        : 'Sending request…'
                      : step === 3
                        ? 'Send booking request'
                        : step === 2
                          ? 'Review request'
                          : 'Continue'}
                    {step === 3 ? <Send size={16} /> : <ArrowRight size={16} />}
                  </button>
                </div>
                <p className="cb-footer-note">
                  Subject to approval · No payment collected
                </p>
              </form>
            </>
          )}
        </section>
        <aside className="cb-summary" aria-label="Your package">
          <div className="cb-package-photo">
            {photo ? (
              <img
                src={img(photo)}
                alt={p.images.find((x) => x.id === photo)?.alt || p.name}
              />
            ) : (
              <div className="cb-photo-placeholder">
                <Sparkles size={40} />
                <span>A memorable event, made for you.</span>
              </div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="cb-gallery">
              {p.images.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setPhoto(x.id)}
                  aria-label={'View package photo ' + (i + 1)}
                  aria-pressed={photo === x.id}
                >
                  <img src={img(x.id)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <div className="cb-summary-body">
            <p className="cb-eyebrow">Your package · {p.service}</p>
            {p.showTitle && <h2>{p.name}</h2>}
            {p.subheader && <p>{p.subheader}</p>}
            <p className="cb-price">
              {money(p.price)}
              <small>
                {p.unitMode === 'Per unit' &&
                p.unitCalculation === 'Multiply package'
                  ? ' / ' + p.unitLabel
                  : ' starting price'}
              </small>
            </p>
            <p className="cb-duration">
              <Clock size={16} />
              {lengthLabel(p.includedMinutes)} included
            </p>
            {((dayBased && p.extraDays) || (!dayBased && p.extraHours)) && (
              <p className="cb-muted">
                +{money((dayBased ? p.dailyRate : p.extraRate) * 100)} per
                additional {dayBased ? 'day' : 'hour'}
                {p.unitMode === 'Per unit' &&
                p.unitCalculation === 'Multiply package'
                  ? ' per ' + p.unitLabel
                  : ''}
              </p>
            )}
            {p.description && <p className="cb-description">{p.description}</p>}
            <div className="cb-summary-notice">
              <CalendarDays size={18} />
              <p>
                Choose your preferred date. {business.name} will review your
                request and confirm the details.
              </p>
            </div>
            <div className="cb-contact">
              <BrandSocialLinks links={business.socialLinks} />
              <strong>Questions before you book?</strong>
              {business.email && (
                <a href={'mailto:' + business.email}>
                  <Mail size={15} />
                  {business.email}
                </a>
              )}
              {business.phone && (
                <a href={'tel:' + business.phone.replace(/[^+\d]/g, '')}>
                  <Phone size={15} />
                  {business.phone}
                </a>
              )}
            </div>
          </div>
        </aside>
      </main>
      <footer className="cb-powered">
        Booking requests powered by <strong>Eventdeskly</strong>
      </footer>
    </div>
  );
}
