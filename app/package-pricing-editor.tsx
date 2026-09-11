'use client';
import { useId, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  ListChecks,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PackageSettings } from '@/lib/package-config';
import { PackageNumberInput } from './package-number-input';
import {
  weekdays,
  slotMinutes,
  type BookingSlot,
  type PricingTier,
} from '@/lib/package-pricing';
type Choice = { value: string; label: string; description?: string };
const intervals = [15, 30, 60, 120, 180, 240];
const intervalLabel = (n: number) =>
  n < 60 ? `${n} Minute Increments` : `${n / 60} Hour Increments`;
function RadioChoices({
  label,
  value,
  choices,
  onChange,
  cards = false,
}: {
  label: string;
  value: string;
  choices: Choice[];
  onChange: (value: string) => void;
  cards?: boolean;
}) {
  const name = useId();
  return (
    <fieldset
      className={'ps-choice-field ' + (cards ? 'ps-calendar-field' : '')}
    >
      <legend>{label}</legend>
      <div className={cards ? 'ps-calendar-cards' : 'ps-radio-list'}>
        {choices.map((choice, i) => (
          <label
            key={choice.value}
            className={
              cards
                ? 'ps-calendar-card ' +
                  (choice.value === value ? 'selected' : '')
                : ''
            }
          >
            {cards && (
              <div className="ps-mode-icon">
                {i === 0 ? (
                  <CalendarDays size={32} />
                ) : i === 1 ? (
                  <Clock3 size={32} />
                ) : (
                  <ListChecks size={32} />
                )}
              </div>
            )}
            <span>
              <input
                type="radio"
                name={name}
                checked={value === choice.value}
                onChange={() => onChange(choice.value)}
              />
              <strong>{choice.label}</strong>
            </span>
            {choice.description && <small>{choice.description}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max = 1000000,
  step = 1,
  suffix,
  help,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  help?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="ps-input-unit">
        {suffix === '$' && <span>$</span>}
        <PackageNumberInput
          aria-label={label}
          required
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={onChange}
        />
        {suffix && suffix !== '$' && <span>{suffix}</span>}
      </div>
      {help && <small>{help}</small>}
    </label>
  );
}
function Duration({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="ps-duration-inputs">
        <Numeric
          label={label + ' hours'}
          value={Math.floor(value / 60)}
          onChange={(n) => {
            if (Number.isInteger(n) && n >= 0 && n <= 168)
              onChange(n * 60 + (value % 60));
          }}
          max={168}
          suffix="Hr"
        />
        <Numeric
          label={label + ' minutes'}
          value={value % 60}
          onChange={(n) => {
            if (Number.isInteger(n) && n >= 0 && n <= 59)
              onChange(Math.floor(value / 60) * 60 + n);
          }}
          max={59}
          suffix="Min"
        />
      </div>
    </div>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Choice[];
  onChange: (s: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => onChange(String(v))}>
        <SelectTrigger aria-label={label}>
          <SelectValue>
            {options.find((o) => o.value === value)?.label || value}
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
function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="time"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function PackagePricingEditor({
  settings: s,
  price,
  onPrice,
  onChange,
  busy,
}: {
  settings: PackageSettings;
  price: number;
  onPrice: (n: number) => void;
  onChange: (s: PackageSettings) => void;
  busy: boolean;
}) {
  const minimumUnitsId = useId();
  const [slotEditor, setSlotEditor] = useState<{
      index: number;
      slot: BookingSlot;
    }>(),
    [tierEditor, setTierEditor] = useState<{
      index: number;
      tier: PricingTier;
    }>(),
    [error, setError] = useState('');
  const update = (patch: Partial<PackageSettings>) =>
    onChange({ ...s, ...patch });
  const dayBased = s.dateMode === 'Date Only' && s.durationUnit === 'Days',
    legacyUnits =
      s.unitMode !== 'None' && s.unitCalculation === 'Multiply package';
  function included(value: number) {
    update(
      dayBased
        ? {
            includedDays: value,
            minDays:
              s.minDays === s.includedDays ? value : Math.min(value, s.minDays),
            maxDays: Math.max(value, s.maxDays),
          }
        : {
            includedMinutes: value,
            minMinutes:
              s.minMinutes === s.includedMinutes
                ? value
                : Math.min(value, s.minMinutes),
            maxMinutes: Math.max(value, s.maxMinutes),
          },
    );
  }
  function mode(value: string) {
    update({
      dateMode: value as PackageSettings['dateMode'],
      durationUnit: value === 'Date Only' ? 'Days' : 'Hours',
      ...(value === 'Date Only' ? { picker: 'Automatic slots' as const } : {}),
    });
  }
  function editSlot(index: number) {
    setError('');
    const end = (9 * 60 + s.includedMinutes) % 1440;
    setSlotEditor({
      index,
      slot:
        index < 0
          ? {
              id: crypto.randomUUID(),
              start: '09:00',
              end:
                String(Math.floor(end / 60)).padStart(2, '0') +
                ':' +
                String(end % 60).padStart(2, '0'),
              label: '',
              days: [0, 1, 2, 3, 4, 5, 6],
            }
          : structuredClone(s.predefinedSlots[index]),
    });
  }
  function editTier(index: number) {
    setError('');
    const last = s.unitTiers.at(-1);
    setTierEditor({
      index,
      tier:
        index < 0
          ? {
              min: last?.max === null ? 0 : (last?.max ?? -1) + 1,
              max: null,
              rate: 0,
              included: 0,
            }
          : { ...s.unitTiers[index] },
    });
  }
  function saveSlot() {
    if (!slotEditor) return;
    const { slot, index } = slotEditor;
    if (
      !slot.start ||
      !slot.end ||
      !slot.days.length ||
      slot.label.length > 100
    ) {
      setError('Choose start/end times and at least one weekday.');
      return;
    }
    if (
      s.predefinedSlots.some(
        (x, i) =>
          i !== index &&
          x.start === slot.start &&
          x.days.some((d) => slot.days.includes(d)),
      )
    ) {
      setError('A slot already starts at this time on a selected weekday.');
      return;
    }
    update({
      predefinedSlots:
        index < 0
          ? [...s.predefinedSlots, slot]
          : s.predefinedSlots.map((x, i) => (i === index ? slot : x)),
    });
    setSlotEditor(undefined);
  }
  function saveTier() {
    if (!tierEditor) return;
    const { tier, index } = tierEditor;
    if (
      !Number.isInteger(tier.min) ||
      tier.min < 0 ||
      tier.min > 100000 ||
      (tier.max !== null &&
        (!Number.isInteger(tier.max) ||
          tier.max < tier.min ||
          tier.max > 100000)) ||
      !Number.isFinite(tier.rate) ||
      tier.rate < 0 ||
      tier.rate > 1000000 ||
      !Number.isInteger(tier.included) ||
      tier.included < 0 ||
      tier.included > 100000
    ) {
      setError('Enter valid unit limits and a non-negative rate.');
      return;
    }
    if (
      s.unitTiers.some(
        (x, i) =>
          i !== index &&
          tier.min <= (x.max ?? Infinity) &&
          (tier.max ?? Infinity) >= x.min,
      )
    ) {
      setError('Pricing tiers cannot overlap.');
      return;
    }
    update({
      unitTiers: (index < 0
        ? [...s.unitTiers, tier]
        : s.unitTiers.map((x, i) => (i === index ? tier : x))
      ).sort((a, b) => a.min - b.min),
    });
    setTierEditor(undefined);
  }
  const sectionSave = (
    <div className="ps-section-footer">
      <button className="primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save package'}
      </button>
    </div>
  );
  return (
    <div className="pricing-scheduling-editor">
      <fieldset className="ps-section" disabled={busy}>
        <legend>Scheduling Mode</legend>
        <div className="ps-scheduling-layout">
          <RadioChoices
            label="Scheduling type"
            value={s.dateMode}
            choices={['Date & Time', 'Date Only'].map((value) => ({
              value,
              label: value,
            }))}
            onChange={mode}
          />
          {s.dateMode === 'Date Only' ? (
            <div className="ps-calendar-card selected">
              <div className="ps-mode-icon">
                <CalendarDays size={32} />
              </div>
              <strong>Calendar Picker</strong>
              <small>
                Clients choose the first and last day of their booking.
              </small>
              {!dayBased && (
                <p className="ps-compatibility">
                  This existing package uses an hourly duration without a start
                  time.{' '}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => mode('Date Only')}
                  >
                    Use day-based pricing
                  </button>
                </p>
              )}
            </div>
          ) : (
            <RadioChoices
              cards
              label="Calendar mode"
              value={s.picker}
              onChange={(picker) =>
                update({ picker: picker as PackageSettings['picker'] })
              }
              choices={[
                {
                  value: 'Minimal',
                  label: 'Minimal',
                  description:
                    'Clients choose a date and enter their preferred start time.',
                },
                {
                  value: 'Automatic slots',
                  label: 'Automatic Slots',
                  description:
                    'Generate available start times at your chosen slot interval.',
                },
                {
                  value: 'Predefined slots',
                  label: 'Predefined Slots',
                  description:
                    'Offer specific start and end times on selected weekdays.',
                },
              ]}
            />
          )}
        </div>
        {s.dateMode === 'Date & Time' && s.picker === 'Automatic slots' && (
          <div className="ps-indented">
            <SelectField
              label="Slot Interval"
              value={String(s.slotInterval)}
              options={intervals.map((n) => ({
                value: String(n),
                label: intervalLabel(n),
              }))}
              onChange={(n) => update({ slotInterval: Number(n) })}
            />
            <small>
              How far apart are your slot start times? This is independent of
              booking length increments.
            </small>
          </div>
        )}
        {s.dateMode === 'Date & Time' && s.picker === 'Predefined slots' && (
          <div className="ps-slot-list">
            {s.slots && !s.predefinedSlots.length && (
              <label className="field">
                <span>Existing predefined start times</span>
                <textarea
                  value={s.slots}
                  onChange={(e) => update({ slots: e.target.value })}
                />
                <small>
                  Add structured slots below to use start/end times, labels and
                  weekdays instead.
                </small>
              </label>
            )}
            {s.predefinedSlots.map((slot, i) => (
              <div className="ps-editable-row" key={slot.id}>
                <div>
                  <strong>{slot.label || slot.start + '–' + slot.end}</strong>
                  <small>
                    {slot.start}–{slot.end} · {slotMinutes(slot) / 60} hr ·{' '}
                    {slot.days.map((d) => weekdays[d].slice(0, 3)).join(', ')}
                  </small>
                </div>
                <button
                  type="button"
                  className="text-button"
                  aria-label={'Edit slot ' + (i + 1)}
                  onClick={() => editSlot(i)}
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  type="button"
                  className="text-button"
                  aria-label={'Delete slot ' + (i + 1)}
                  onClick={() =>
                    update({
                      predefinedSlots: s.predefinedSlots.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            ))}
            {!s.predefinedSlots.length && !s.slots && (
              <p>No slots defined yet.</p>
            )}
            <button
              type="button"
              className="secondary"
              disabled={s.predefinedSlots.length >= 40}
              onClick={() => editSlot(-1)}
            >
              <Plus size={16} />
              Add slot
            </button>
          </div>
        )}
        {sectionSave}
      </fieldset>
      <fieldset className="ps-section" disabled={busy}>
        <legend>Pricing</legend>
        <div className="ps-price-top">
          <Numeric
            label="Starting Rate"
            value={price}
            onChange={onPrice}
            step={0.01}
            suffix="$"
          />
          {dayBased ? (
            <Numeric
              label="Number of days included"
              value={s.includedDays}
              min={1}
              max={365}
              onChange={included}
              suffix="Day"
            />
          ) : (
            <Duration
              label="Number of hours included"
              value={s.includedMinutes}
              onChange={included}
            />
          )}
        </div>
        <label className="package-toggle">
          <input
            type="checkbox"
            checked={s.taxable}
            onChange={(e) => update({ taxable: e.target.checked })}
          />
          Taxable package
        </label>
        <div className="ps-pricing-row">
          <RadioChoices
            label={
              dayBased
                ? 'Allow customer to book extra days?'
                : 'Charge for extra hours?'
            }
            value={String(dayBased ? s.extraDays : s.extraHours)}
            choices={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            onChange={(v) =>
              update(
                dayBased
                  ? { extraDays: v === 'true' }
                  : {
                      extraHours: v === 'true',
                      ...(v === 'false'
                        ? {
                            minMinutes: s.includedMinutes,
                            maxMinutes: s.includedMinutes,
                          }
                        : {}),
                    },
              )
            }
          />
          {(dayBased ? s.extraDays : s.extraHours) && (
            <div className="ps-rate-grid">
              <Numeric
                label={dayBased ? 'Daily Rate' : 'Hourly Rate'}
                value={dayBased ? s.dailyRate : s.extraRate}
                onChange={(n) =>
                  update(dayBased ? { dailyRate: n } : { extraRate: n })
                }
                step={0.01}
                suffix="$"
              />
              {dayBased ? (
                <>
                  <Numeric
                    label="Minimum length (days)"
                    min={1}
                    max={365}
                    value={s.minDays}
                    onChange={(n) => update({ minDays: n })}
                    suffix="Day"
                  />
                  <Numeric
                    label="Maximum length (days)"
                    min={1}
                    max={365}
                    value={s.maxDays}
                    onChange={(n) => update({ maxDays: n })}
                    suffix="Day"
                  />
                </>
              ) : (
                <>
                  <Duration
                    label="Minimum length"
                    value={s.minMinutes}
                    onChange={(n) => update({ minMinutes: n })}
                  />
                  <Duration
                    label="Maximum length"
                    value={s.maxMinutes}
                    onChange={(n) => update({ maxMinutes: n })}
                  />
                  <SelectField
                    label="Booking Increment"
                    value={String(s.increment)}
                    options={intervals.map((n) => ({
                      value: String(n),
                      label: intervalLabel(n),
                    }))}
                    onChange={(n) => update({ increment: Number(n) })}
                  />
                </>
              )}
            </div>
          )}
        </div>
        <div className="ps-pricing-row">
          <RadioChoices
            label="Charge by unit?"
            value={legacyUnits ? 'Legacy' : s.unitMode}
            choices={[
              { value: 'Per unit', label: 'Yes, charge per unit' },
              { value: 'Per range', label: 'Yes, charge by unit range' },
              { value: 'None', label: 'No' },
              ...(legacyUnits
                ? [{ value: 'Legacy', label: 'Existing package multiplier' }]
                : []),
            ]}
            onChange={(unitMode) =>
              unitMode !== 'Legacy' &&
              update({
                unitMode: unitMode as PackageSettings['unitMode'],
                unitCalculation: 'Add unit charges',
              })
            }
          />
          {s.unitMode !== 'None' && (
            <div className="ps-unit-settings">
              <label className="field">
                <span>Unit Name</span>
                <input
                  list="package-unit-names"
                  value={s.unitLabel}
                  maxLength={40}
                  onChange={(e) => update({ unitLabel: e.target.value })}
                />
                <datalist id="package-unit-names">
                  {[
                    'Unit',
                    'Guest',
                    'User',
                    'Child',
                    'Foot',
                    'Square Foot',
                    'Acre',
                    'Meter',
                    'Square Meter',
                    'Letter/Number',
                    'Dozen',
                    'Document',
                    'E-Signature',
                  ].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </datalist>
              </label>
              {legacyUnits ? (
                <>
                  <p className="ps-compatibility">
                    This existing package multiplies its starting and extra-hour
                    prices by quantity. Choose a tier pricing option to change
                    future quotes.
                  </p>
                  <div className="form-grid">
                    <Numeric
                      label="Minimum units"
                      value={s.minUnits}
                      onChange={(n) => update({ minUnits: n })}
                      min={1}
                      max={100000}
                    />
                    <Numeric
                      label="Maximum units"
                      value={s.maxUnits}
                      onChange={(n) => update({ maxUnits: n })}
                      min={1}
                      max={100000}
                    />
                  </div>
                </>
              ) : (
                <>
                  {s.unitTiers.map((tier, i) => (
                    <div className="ps-editable-row" key={i}>
                      <div>
                        <strong>
                          {tier.min}–{tier.max ?? 'unlimited'} {s.unitLabel}(s)
                        </strong>
                        <small>
                          ${tier.rate.toFixed(2)}{' '}
                          {s.unitMode === 'Per unit'
                            ? 'per ' +
                              s.unitLabel +
                              ' · ' +
                              tier.included +
                              ' included'
                            : 'flat rate'}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={'Edit pricing tier ' + (i + 1)}
                        onClick={() => editTier(i)}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={'Delete pricing tier ' + (i + 1)}
                        onClick={() =>
                          update({
                            unitTiers: s.unitTiers.filter((_, j) => j !== i),
                          })
                        }
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  ))}
                  {!s.unitTiers.length && <p>No pricing tiers defined yet.</p>}
                  <button
                    type="button"
                    className="secondary"
                    disabled={s.unitTiers.length >= 30}
                    onClick={() => editTier(-1)}
                  >
                    <Plus size={16} />
                    Add pricing tier
                  </button>
                  <p className="muted">
                    Unit charges are added to the starting rate and extra time.
                    Set those rates to zero to charge only by unit.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
        <div className="ps-pricing-row">
          <RadioChoices
            label="Require Deposit?"
            value={s.depositMode}
            choices={[
              { value: 'Flat rate', label: 'Flat Rate' },
              { value: 'Percentage', label: 'Percentage' },
              { value: 'None', label: 'None' },
              { value: 'Business default', label: 'Business default' },
            ]}
            onChange={(depositMode) =>
              update({
                depositMode: depositMode as PackageSettings['depositMode'],
              })
            }
          />
          <div>
            {['Flat rate', 'Percentage'].includes(s.depositMode) && (
              <Numeric
                label={
                  s.depositMode === 'Percentage'
                    ? 'Deposit Percentage'
                    : 'Deposit Amount'
                }
                value={s.depositValue}
                onChange={(depositValue) => update({ depositValue })}
                max={s.depositMode === 'Percentage' ? 100 : 1000000}
                step={0.01}
                suffix={s.depositMode === 'Percentage' ? '%' : '$'}
                help={
                  s.depositMode === 'Percentage'
                    ? s.depositBasis === 'Booking total share'
                      ? 'Percentage of the booking total, including adjustments, extras and tax. With multiple packages, each uses its share of the total.'
                      : 'This existing package uses its package amount before extras and tax.'
                    : 'A fixed deposit, capped at the quoted total.'
                }
              />
            )}
          </div>
        </div>
        {s.depositMode === 'Percentage' &&
          s.depositBasis === 'Package amount' && (
            <button
              type="button"
              className="text-button"
              onClick={() => update({ depositBasis: 'Booking total share' })}
            >
              Use the booking total for future percentage deposits
            </button>
          )}
        {sectionSave}
      </fieldset>
      <fieldset className="ps-section" disabled={busy}>
        <legend>Availability</legend>
        <RadioChoices
          label="Is this package available every day of the week?"
          value={s.availabilityMode}
          choices={[
            { value: 'Every day', label: 'Yes' },
            { value: 'Limited hours', label: 'Yes, with limited hours' },
            { value: 'By weekday', label: 'No — choose days individually' },
            ...(s.availabilityMode === 'Legacy window'
              ? [
                  {
                    value: 'Legacy window',
                    label: 'Keep existing availability window',
                  },
                ]
              : []),
          ]}
          onChange={(availabilityMode) =>
            update({
              availabilityMode:
                availabilityMode as PackageSettings['availabilityMode'],
            })
          }
        />
        {s.availabilityMode === 'Limited hours' && (
          <div className="form-grid">
            <TimeInput
              label="Earliest Start"
              value={s.startTime}
              onChange={(startTime) => update({ startTime })}
            />
            <TimeInput
              label="Latest Start"
              value={s.endTime}
              onChange={(endTime) => update({ endTime })}
            />
          </div>
        )}
        {s.availabilityMode === 'By weekday' && (
          <div className="ps-weekdays">
            {weekdays.map((name, i) => (
              <div className="ps-weekday" key={name}>
                <SelectField
                  label={'Available ' + name + '?'}
                  value={s.weekdayHours[i].mode}
                  options={[
                    { value: 'All day', label: 'Yes, all day' },
                    { value: 'Limited hours', label: 'Yes, certain hours' },
                    { value: 'Unavailable', label: 'No' },
                  ]}
                  onChange={(mode) =>
                    update({
                      weekdayHours: s.weekdayHours.map((d, j) =>
                        i === j ? { ...d, mode: mode as typeof d.mode } : d,
                      ),
                    })
                  }
                />
                {s.weekdayHours[i].mode === 'Limited hours' && (
                  <>
                    <TimeInput
                      label={name + ' Earliest Start'}
                      value={s.weekdayHours[i].start}
                      onChange={(start) =>
                        update({
                          weekdayHours: s.weekdayHours.map((d, j) =>
                            j === i ? { ...d, start } : d,
                          ),
                        })
                      }
                    />
                    <TimeInput
                      label={name + ' Latest Start'}
                      value={s.weekdayHours[i].end}
                      onChange={(end) =>
                        update({
                          weekdayHours: s.weekdayHours.map((d, j) =>
                            j === i ? { ...d, end } : d,
                          ),
                        })
                      }
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {s.availabilityMode === 'Legacy window' && (
          <>
            <p className="muted">
              The existing rule requires the complete event to fit inside these
              hours. Select a new availability option above to use
              earliest/latest start times.
            </p>
            <div className="package-days">
              {weekdays.map((day, i) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={s.days.includes(i)}
                    onChange={(e) =>
                      update({
                        days: e.target.checked
                          ? [...s.days, i]
                          : s.days.filter((d) => d !== i),
                      })
                    }
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
            <div className="form-grid">
              <TimeInput
                label="Available from"
                value={s.startTime}
                onChange={(startTime) => update({ startTime })}
              />
              <TimeInput
                label="Available until"
                value={s.endTime}
                onChange={(endTime) => update({ endTime })}
              />
            </div>
          </>
        )}
        {s.availabilityMode !== 'Legacy window' && (
          <p className="muted">
            Time limits apply to the event’s start. Date-only bookings must use
            available weekdays throughout their date range. Business-wide
            notice, blackout dates and daily limits also apply.
          </p>
        )}
        {sectionSave}
      </fieldset>
      <Dialog
        open={!!slotEditor}
        onOpenChange={(open) => !open && setSlotEditor(undefined)}
      >
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {slotEditor?.index === -1 ? 'Add' : 'Edit'} Slot
            </DialogTitle>
            <DialogDescription>
              Set the time window and the weekdays when clients can book it.
            </DialogDescription>
          </DialogHeader>
          {slotEditor && (
            <>
              <div className="form-grid">
                <TimeInput
                  label="Start Time"
                  value={slotEditor.slot.start}
                  onChange={(start) =>
                    setSlotEditor({
                      ...slotEditor,
                      slot: { ...slotEditor.slot, start },
                    })
                  }
                />
                <TimeInput
                  label="End Time"
                  value={slotEditor.slot.end}
                  onChange={(end) =>
                    setSlotEditor({
                      ...slotEditor,
                      slot: { ...slotEditor.slot, end },
                    })
                  }
                />
              </div>
              <label className="field">
                <span>Optional Label</span>
                <input
                  maxLength={100}
                  value={slotEditor.slot.label}
                  onChange={(e) =>
                    setSlotEditor({
                      ...slotEditor,
                      slot: { ...slotEditor.slot, label: e.target.value },
                    })
                  }
                />
                <small>
                  Leave blank to show start and end time. An end time at or
                  before the start means the following day.
                </small>
              </label>
              <fieldset>
                <legend>Days Available</legend>
                <div className="package-days">
                  {weekdays.map((day, i) => (
                    <label key={day}>
                      <input
                        type="checkbox"
                        checked={slotEditor.slot.days.includes(i)}
                        onChange={(e) =>
                          setSlotEditor({
                            ...slotEditor,
                            slot: {
                              ...slotEditor.slot,
                              days: e.target.checked
                                ? [...slotEditor.slot.days, i]
                                : slotEditor.slot.days.filter((d) => d !== i),
                            },
                          })
                        }
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button type="button" className="primary" onClick={saveSlot}>
                Apply slot
              </button>
              <small>Save the package to store these changes.</small>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!tierEditor}
        onOpenChange={(open) => !open && setTierEditor(undefined)}
      >
        <DialogContent className="crm-dialog">
          <DialogHeader>
            <DialogTitle>
              {tierEditor?.index === -1 ? 'Add' : 'Edit'} Pricing Tier
            </DialogTitle>
            <DialogDescription>
              Choose a quantity range and the price that applies within it.
            </DialogDescription>
          </DialogHeader>
          {tierEditor && (
            <>
              <div className="form-grid">
                <label className="field" htmlFor={minimumUnitsId}>
                  <span>Minimum Units</span>
                  <PackageNumberInput
                    id={minimumUnitsId}
                    aria-label="Minimum Units"
                    min={0}
                    max={100000}
                    value={tierEditor.tier.min}
                    onValueChange={(min) =>
                      setTierEditor({
                        ...tierEditor,
                        tier: {
                          ...tierEditor.tier,
                          min,
                        },
                      })
                    }
                  />
                  <small>Zero means no minimum.</small>
                </label>
                <label className="field">
                  <span>Maximum Units</span>
                  <input
                    aria-label="Maximum Units"
                    type="number"
                    min={0}
                    max={100000}
                    value={tierEditor.tier.max ?? ''}
                    onChange={(e) =>
                      setTierEditor({
                        ...tierEditor,
                        tier: {
                          ...tierEditor.tier,
                          max:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                  <small>
                    Leave blank for unlimited, up to 100,000 units per request.
                  </small>
                </label>
              </div>
              <Numeric
                label={
                  s.unitMode === 'Per range' ? 'Flat Rate' : 'Price per Unit'
                }
                suffix="$"
                step={0.01}
                value={tierEditor.tier.rate}
                onChange={(rate) =>
                  setTierEditor({
                    ...tierEditor,
                    tier: { ...tierEditor.tier, rate },
                  })
                }
              />
              {s.unitMode === 'Per unit' && (
                <Numeric
                  label="Included Units"
                  value={tierEditor.tier.included}
                  max={100000}
                  onChange={(included) =>
                    setTierEditor({
                      ...tierEditor,
                      tier: { ...tierEditor.tier, included },
                    })
                  }
                  help="Only charge for units above this quantity."
                />
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button type="button" className="primary" onClick={saveTier}>
                Apply tier
              </button>
              <small>Save the package to store these changes.</small>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
