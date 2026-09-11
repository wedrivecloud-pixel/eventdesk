import type { PackageRecord, LineItem } from './crm';
import {
  durationRules,
  packageDurationLabel,
  unitBounds,
  availabilityWindow,
  slotMinutes,
  packageDates,
  type PricingTier,
  type BookingSlot,
  type WeekdayHours,
} from './package-pricing';
export type PackageSettings = {
  status: 'Public' | 'Private' | 'Disabled';
  taxable: boolean;
  group: string;
  dateMode: 'Date & Time' | 'Date Only';
  picker: 'Minimal' | 'Automatic slots' | 'Predefined slots';
  slots: string;
  includedMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  increment: number;
  extraHours: boolean;
  extraRate: number;
  unitMode: 'None' | 'Per unit' | 'Per range';
  unitCalculation: 'Multiply package' | 'Add unit charges';
  unitTiers: PricingTier[];
  durationUnit: 'Hours' | 'Days';
  includedDays: number;
  minDays: number;
  maxDays: number;
  extraDays: boolean;
  dailyRate: number;
  slotInterval: number;
  predefinedSlots: BookingSlot[];
  availabilityMode:
    | 'Legacy window'
    | 'Every day'
    | 'Limited hours'
    | 'By weekday';
  weekdayHours: WeekdayHours[];
  unitLabel: string;
  minUnits: number;
  maxUnits: number;
  depositMode: 'Business default' | 'Flat rate' | 'Percentage' | 'None';
  depositValue: number;
  depositBasis: 'Package amount' | 'Booking total share';
  days: number[];
  startTime: string;
  endTime: string;
  showTitle: boolean;
  subheader: string;
  bookingMode: 'Booking request' | 'Proposal request' | 'Lead form';
  leadDays: number;
  requiredStaff: number;
  requireBackdrop: boolean;
  allowSkipBackdrop: boolean;
  includedAddonIds: string[];
};
export function packageSettings(
  value: Partial<PackageSettings> = {},
  duration = '',
): PackageSettings {
  const hours = /([\d.]+)\s*h/i.exec(duration);
  const minutes = /([\d.]+)\s*m/i.exec(duration);
  const length =
    Math.max(
      15,
      Math.round(Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)),
    ) || 240;
  const base = hours || minutes ? length : 240;
  return {
    status: 'Public',
    taxable: true,
    group: '',
    dateMode: 'Date & Time',
    picker: 'Minimal',
    slots: '',
    includedMinutes: base,
    minMinutes: base,
    maxMinutes: base,
    increment: 30,
    extraHours: false,
    extraRate: 0,
    unitMode: 'None',
    unitCalculation: 'Multiply package',
    unitTiers: [],
    durationUnit: 'Hours',
    includedDays: 1,
    minDays: 1,
    maxDays: 1,
    extraDays: false,
    dailyRate: 0,
    slotInterval: value.increment ?? 30,
    predefinedSlots: [],
    availabilityMode: 'Legacy window',
    weekdayHours: Array.from({ length: 7 }, () => ({
      mode: 'All day',
      start: '00:00',
      end: '23:59',
    })),
    unitLabel: 'guest',
    minUnits: 1,
    maxUnits: 1000,
    depositMode: 'Business default',
    depositValue: 0,
    depositBasis: 'Package amount',
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: '00:00',
    endTime: '23:59',
    showTitle: true,
    subheader: '',
    bookingMode: 'Booking request',
    leadDays: 0,
    requiredStaff: 0,
    requireBackdrop: false,
    allowSkipBackdrop: true,
    includedAddonIds: [],
    ...value,
  };
}
export const durationLabel = (n: number) =>
  `${Math.floor(n / 60) ? `${Math.floor(n / 60)} hr` : ''}${n % 60 ? ` ${n % 60} min` : ''}`.trim();
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validatePackageSettings(
  value: unknown,
  duration: string,
): PackageSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid package settings.');
  const s = packageSettings(value as Partial<PackageSettings>, duration);
  const choices: Partial<Record<keyof PackageSettings, string[]>> = {
    status: ['Public', 'Private', 'Disabled'],
    dateMode: ['Date & Time', 'Date Only'],
    picker: ['Minimal', 'Automatic slots', 'Predefined slots'],
    unitMode: ['None', 'Per unit', 'Per range'],
    unitCalculation: ['Multiply package', 'Add unit charges'],
    durationUnit: ['Hours', 'Days'],
    availabilityMode: [
      'Legacy window',
      'Every day',
      'Limited hours',
      'By weekday',
    ],
    depositMode: ['Business default', 'Flat rate', 'Percentage', 'None'],
    depositBasis: ['Package amount', 'Booking total share'],
    bookingMode: ['Booking request', 'Proposal request', 'Lead form'],
  };
  for (const [k, options] of Object.entries(choices)) {
    const selected = s[k as keyof PackageSettings];
    if (typeof selected !== 'string' || !options.includes(selected))
      throw new Error(`Invalid ${k}.`);
  }
  for (const k of [
    'taxable',
    'extraHours',
    'extraDays',
    'showTitle',
    'requireBackdrop',
    'allowSkipBackdrop',
  ] as const)
    if (typeof s[k] !== 'boolean') throw new Error(`Invalid ${k}.`);
  for (const [k, max] of [
    ['includedMinutes', 10080],
    ['minMinutes', 10080],
    ['maxMinutes', 10080],
    ['increment', 240],
    ['extraRate', 1000000],
    ['dailyRate', 1000000],
    ['includedDays', 365],
    ['minDays', 365],
    ['maxDays', 365],
    ['slotInterval', 240],
    ['minUnits', 100000],
    ['maxUnits', 100000],
    ['depositValue', 1000000],
    ['leadDays', 730],
    ['requiredStaff', 100],
  ] as const) {
    const n = s[k];
    if (
      typeof n !== 'number' ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > max ||
      (!['extraRate', 'dailyRate', 'depositValue'].includes(k) &&
        !Number.isInteger(n))
    )
      throw new Error(`Invalid ${k}.`);
  }
  if (
    s.minMinutes < 15 ||
    s.includedMinutes < 15 ||
    s.maxMinutes < s.minMinutes ||
    s.includedMinutes < s.minMinutes ||
    s.includedMinutes > s.maxMinutes
  )
    throw new Error(
      'Included duration must be within the minimum and maximum duration.',
    );
  if (![15, 30, 60, 120, 180, 240].includes(s.increment))
    throw new Error('Choose a valid booking increment.');
  if (![15, 30, 60, 120, 180, 240].includes(s.slotInterval))
    throw Error('Choose a valid slot interval.');
  if (
    s.includedDays < 1 ||
    s.minDays < 1 ||
    s.maxDays < s.minDays ||
    (s.extraDays && (s.includedDays < s.minDays || s.includedDays > s.maxDays))
  )
    throw Error('Included days must be within the minimum and maximum length.');
  if (s.durationUnit === 'Days' && s.dateMode !== 'Date Only')
    throw Error('Day-based packages must use Date Only scheduling.');
  if (
    !Array.isArray(s.weekdayHours) ||
    s.weekdayHours.length !== 7 ||
    s.weekdayHours.some(
      (d) =>
        !d ||
        !['All day', 'Limited hours', 'Unavailable'].includes(d.mode) ||
        !clock.test(d.start) ||
        !clock.test(d.end) ||
        d.start > d.end,
    )
  )
    throw Error('Choose valid earliest/latest start times for each weekday.');
  if (
    s.availabilityMode === 'By weekday' &&
    s.weekdayHours.every((d) => d.mode === 'Unavailable')
  )
    throw Error('Select at least one available weekday.');
  if (!Array.isArray(s.unitTiers) || s.unitTiers.length > 30)
    throw Error('Use up to 30 pricing tiers.');
  for (const t of s.unitTiers) {
    if (
      !t ||
      !Number.isInteger(t.min) ||
      t.min < 0 ||
      t.min > 100000 ||
      (t.max !== null &&
        (!Number.isInteger(t.max) || t.max < t.min || t.max > 100000)) ||
      !Number.isFinite(t.rate) ||
      t.rate < 0 ||
      t.rate > 1000000 ||
      !Number.isInteger(t.included) ||
      t.included < 0 ||
      t.included > 100000
    )
      throw Error('Enter valid tier limits, prices and included units.');
  }
  const tiers = [...s.unitTiers].sort((a, b) => a.min - b.min);
  if (tiers.some((t, i) => i > 0 && t.min <= (tiers[i - 1].max ?? Infinity)))
    throw Error('Pricing tiers cannot overlap.');
  if (
    s.unitMode !== 'None' &&
    s.unitCalculation === 'Add unit charges' &&
    !tiers.length
  )
    throw Error('Add at least one pricing tier.');
  if (s.unitMode === 'Per range' && s.unitCalculation !== 'Add unit charges')
    throw Error('Unit ranges require tier pricing.');
  if (!Array.isArray(s.predefinedSlots) || s.predefinedSlots.length > 40)
    throw Error('Use up to 40 predefined slots.');
  for (const slot of s.predefinedSlots) {
    if (
      !slot ||
      typeof slot.id !== 'string' ||
      !slot.id ||
      slot.id.length > 100 ||
      !clock.test(slot.start) ||
      !clock.test(slot.end) ||
      typeof slot.label !== 'string' ||
      slot.label.length > 100 ||
      !Array.isArray(slot.days) ||
      !slot.days.length ||
      slot.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      throw Error('Enter valid slot times, labels and weekdays.');
    if (
      s.dateMode === 'Date & Time' &&
      s.picker === 'Predefined slots' &&
      (slotMinutes(slot) < s.minMinutes || slotMinutes(slot) > s.maxMinutes)
    )
      throw Error(
        'Each slot length must fit the package minimum and maximum length.',
      );
    if (
      s.dateMode === 'Date & Time' &&
      s.picker === 'Predefined slots' &&
      slotMinutes(slot) !== s.includedMinutes &&
      (slotMinutes(slot) - s.minMinutes) % s.increment !== 0
    )
      throw Error('Each slot length must follow the booking increment.');
  }
  if (
    new Set(s.predefinedSlots.map((slot) => slot.id)).size !==
      s.predefinedSlots.length ||
    s.predefinedSlots.some((slot, i) =>
      s.predefinedSlots
        .slice(0, i)
        .some(
          (other) =>
            other.start === slot.start &&
            other.days.some((d) => slot.days.includes(d)),
        ),
    )
  )
    throw Error('Use unique slot start times on each weekday.');
  if (s.minUnits < 1 || s.maxUnits < s.minUnits)
    throw new Error('Unit maximum must be at least the minimum.');
  if (s.depositMode === 'Percentage' && s.depositValue > 100)
    throw new Error('Deposit percentage cannot exceed 100.');
  for (const [k, max] of [
    ['group', 100],
    ['subheader', 250],
    ['unitLabel', 40],
    ['slots', 1000],
  ] as const)
    if (typeof s[k] !== 'string' || s[k].length > max)
      throw new Error(`Invalid ${k}.`);
  if (
    !Array.isArray(s.days) ||
    !s.days.length ||
    s.days.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
  )
    throw new Error('Select at least one available day.');
  if (
    !clock.test(s.startTime) ||
    !clock.test(s.endTime) ||
    (s.availabilityMode === 'Legacy window'
      ? s.startTime >= s.endTime
      : s.startTime > s.endTime)
  )
    throw new Error('Availability end must be later than its start.');
  if (
    s.picker === 'Predefined slots' &&
    !s.predefinedSlots.length &&
    (!s.slots.trim() || s.slots.split(/[\s,]+/).some((x) => !clock.test(x)))
  )
    throw new Error('Enter start times such as 09:00, 12:00, 17:30.');
  if (
    !Array.isArray(s.includedAddonIds) ||
    s.includedAddonIds.length > 30 ||
    s.includedAddonIds.some((x) => typeof x !== 'string' || x.length > 100)
  )
    throw new Error('Choose up to 30 included add-ons.');
  // Keep only supported fields, including defaults for older packages.
  return Object.fromEntries(
    Object.keys(packageSettings()).map((k) => [
      k,
      s[k as keyof PackageSettings],
    ]),
  ) as PackageSettings;
}
export type PackageSelection = { minutes?: number; units?: number };
export function pricePackage(
  p: PackageRecord | LineItem,
  selection: PackageSelection = {},
): LineItem {
  // Existing quotes without package configuration retain their original price.
  if (!('settings' in p) && !('packageSettings' in p)) return { ...p };
  const s = packageSettings(
    'settings' in p
      ? p.settings
      : 'packageSettings' in p
        ? p.packageSettings
        : undefined,
    p.duration,
  );
  const minutes =
    selection.minutes ??
    ('minutes' in p ? p.minutes : undefined) ??
    durationRules(s).included;
  const lengths = durationRules(s),
    bounds = unitBounds(s);
  const units =
    s.unitMode === 'None'
      ? 1
      : (selection.units ?? ('units' in p ? p.units : undefined) ?? bounds.min);
  if (
    !Number.isInteger(minutes) ||
    minutes < lengths.min ||
    minutes > lengths.max ||
    (minutes !== lengths.included &&
      (minutes - lengths.min) % lengths.increment !== 0)
  )
    throw new Error(
      `${p.name}: choose a duration between ${packageDurationLabel(s, lengths.min)} and ${packageDurationLabel(s, lengths.max)}.`,
    );
  if (
    !Number.isInteger(units) ||
    (units < bounds.min && s.unitMode !== 'None') ||
    units > bounds.max
  )
    throw new Error(`${p.name}: enter ${bounds.min}–${bounds.max} units.`);
  const base = 'basePrice' in p ? (p.basePrice ?? p.price) : p.price;
  const timePrice =
    base +
    (lengths.dayBased
      ? s.extraDays
        ? Math.max(0, minutes / 1440 - s.includedDays) * s.dailyRate * 100
        : 0
      : s.extraHours
        ? (Math.max(0, minutes - s.includedMinutes) / 60) * s.extraRate * 100
        : 0);
  let unitPrice = 0;
  if (s.unitMode !== 'None' && s.unitCalculation === 'Add unit charges') {
    const tier = s.unitTiers.find(
      (t) => units >= t.min && (t.max === null || units <= t.max),
    );
    if (!tier)
      throw Error(
        `${p.name}: no pricing tier covers ${units} ${s.unitLabel}(s).`,
      );
    unitPrice =
      (s.unitMode === 'Per range'
        ? tier.rate
        : Math.max(0, units - tier.included) * tier.rate) * 100;
  }
  const price = Math.round(
    s.unitMode !== 'None' && s.unitCalculation === 'Multiply package'
      ? timePrice * units
      : timePrice + unitPrice,
  );
  if (!Number.isSafeInteger(price) || price > 100000000)
    throw new Error('Package price is too large.');
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    service: p.service,
    price,
    basePrice: base,
    duration: `${packageDurationLabel(s, minutes)}${s.unitMode !== 'None' ? ` · ${units} ${s.unitLabel}(s)` : ''}`,
    minutes,
    units,
    packageSettings: s,
  };
}
const toMinutes = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export function validatePackageSchedule(
  items: LineItem[],
  day: string,
  time: string,
  backdrop: string,
  today?: string,
) {
  for (const p of items) {
    if (!p.packageSettings) continue;
    const s = packageSettings(p.packageSettings, p.duration),
      weekday = new Date(day + 'T12:00:00Z').getUTCDay(),
      window = availabilityWindow(s, weekday);
    if (
      packageDates({ ...p, packageSettings: s }, day).some(
        (d) =>
          !availabilityWindow(s, new Date(d + 'T12:00:00Z').getUTCDay())
            .available,
      )
    )
      throw Error(`${p.name} is unavailable on a selected weekday.`);
    if (s.dateMode === 'Date & Time' && time) {
      const start = toMinutes(time),
        end =
          toMinutes(window.end) +
          (window.mustFit && window.end === '23:59' ? 1 : 0);
      if (
        start < toMinutes(window.start) ||
        (window.mustFit
          ? start + (p.minutes || s.includedMinutes) + (p.extraMinutes || 0)
          : start) > end
      )
        throw new Error(
          `${p.name}: ${window.mustFit ? 'the event must fit' : 'choose a start time'} within ${window.start}–${window.end}.`,
        );
      if (
        s.picker === 'Predefined slots' &&
        (s.predefinedSlots.length
          ? !s.predefinedSlots.some(
              (slot) =>
                slot.start === time &&
                slot.days.includes(weekday) &&
                slotMinutes(slot) === (p.minutes || s.includedMinutes),
            )
          : !s.slots.split(/[\s,]+/).includes(time))
      )
        throw new Error(`${p.name}: choose a predefined start time.`);
      if (
        s.picker === 'Automatic slots' &&
        (start - toMinutes(window.start)) % s.slotInterval !== 0
      )
        throw new Error(
          `${p.name}: start time must follow ${s.slotInterval}-minute slots from ${window.start}.`,
        );
    }
    if (today) {
      if (s.dateMode === 'Date & Time' && !time)
        throw new Error(`${p.name} requires a start time before confirmation.`);
      const earliest = new Date(today + 'T12:00:00Z');
      earliest.setUTCDate(earliest.getUTCDate() + s.leadDays);
      if (day < earliest.toISOString().slice(0, 10))
        throw new Error(`${p.name} requires ${s.leadDays} days of lead time.`);
      if (s.requireBackdrop && !s.allowSkipBackdrop && !backdrop)
        throw new Error(`${p.name} requires a backdrop before confirmation.`);
    }
  }
}
export const imageUrl = (id: string) =>
  `/api/package-images?id=${encodeURIComponent(id)}`;
