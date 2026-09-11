import type { PackageSettings } from './package-config';
import type { LineItem } from './crm';
export type PricingTier = {
  min: number;
  max: number | null;
  rate: number;
  included: number;
};
export type BookingSlot = {
  id: string;
  start: string;
  end: string;
  label: string;
  days: number[];
};
export type WeekdayHours = {
  mode: 'All day' | 'Limited hours' | 'Unavailable';
  start: string;
  end: string;
};
export const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const clockMinutes = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const slotMinutes = (s: Pick<BookingSlot, 'start' | 'end'>) =>
  (clockMinutes(s.end) - clockMinutes(s.start) + 1440) % 1440 || 1440;
export function durationRules(s: Partial<PackageSettings>) {
  const dayBased = s.dateMode === 'Date Only' && s.durationUnit === 'Days';
  return dayBased
    ? {
        dayBased,
        included: (s.includedDays ?? 1) * 1440,
        min: (s.extraDays ? (s.minDays ?? 1) : (s.includedDays ?? 1)) * 1440,
        max: (s.extraDays ? (s.maxDays ?? 1) : (s.includedDays ?? 1)) * 1440,
        increment: 1440,
      }
    : {
        dayBased,
        included: s.includedMinutes ?? 240,
        min: s.minMinutes ?? 240,
        max: s.maxMinutes ?? 240,
        increment: s.increment ?? 30,
      };
}
export function packageDurationLabel(
  s: Partial<PackageSettings>,
  minutes = durationRules(s).included,
) {
  if (durationRules(s).dayBased)
    return minutes / 1440 + (minutes === 1440 ? ' day' : ' days');
  return `${Math.floor(minutes / 60) ? Math.floor(minutes / 60) + ' hr' : ''}${minutes % 60 ? ' ' + (minutes % 60) + ' min' : ''}`.trim();
}
export function unitBounds(s: Partial<PackageSettings>) {
  const tiers = s.unitTiers || [];
  if (
    s.unitMode !== 'None' &&
    s.unitCalculation === 'Add unit charges' &&
    tiers.length
  )
    return {
      min: Math.min(...tiers.map((t) => t.min)),
      max: Math.max(...tiers.map((t) => t.max ?? 100000)),
    };
  return { min: s.minUnits ?? 1, max: s.maxUnits ?? 1000 };
}
export function availabilityWindow(
  s: Partial<PackageSettings>,
  weekday: number,
) {
  if (!s.availabilityMode || s.availabilityMode === 'Legacy window')
    return {
      available: (s.days || []).includes(weekday),
      start: s.startTime || '00:00',
      end: s.endTime || '23:59',
      mustFit: true,
    };
  if (s.availabilityMode === 'By weekday') {
    const day = s.weekdayHours?.[weekday];
    return {
      available: !!day && day.mode !== 'Unavailable',
      start: day?.mode === 'Limited hours' ? day.start : '00:00',
      end: day?.mode === 'Limited hours' ? day.end : '23:59',
      mustFit: false,
    };
  }
  return {
    available: true,
    start:
      s.availabilityMode === 'Limited hours' ? s.startTime || '00:00' : '00:00',
    end:
      s.availabilityMode === 'Limited hours' ? s.endTime || '23:59' : '23:59',
    mustFit: false,
  };
}
export function packageDates(
  item: Pick<LineItem, 'minutes' | 'packageSettings' | 'extraMinutes'>,
  day: string,
) {
  const count = durationRules(item.packageSettings || {}).dayBased
    ? Math.max(
        1,
        (item.minutes || durationRules(item.packageSettings || {}).included) /
          1440,
      )
    : 1;
  if (!Number.isInteger(count) || count > 365)
    throw Error('Bookings may span up to 365 whole days.');
  const occupied =
    count +
    (durationRules(item.packageSettings || {}).dayBased
      ? Math.ceil((item.extraMinutes || 0) / 1440)
      : 0);
  if (occupied > 365) throw Error('Bookings may span up to 365 days.');
  return Array.from({ length: occupied }, (_, i) => {
    const d = new Date(day + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
export function eventDates(items: LineItem[], day: string) {
  return [...new Set(items.flatMap((item) => packageDates(item, day)))].sort();
}
