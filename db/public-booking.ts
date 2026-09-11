import { checkInventory, checkDiscount, publicInventoryAvailability } from './manage-guards';
import { rawDb } from './raw';
import { capacityConflictSql } from './availability';
import {
  durationRules,
  unitBounds,
  packageDates,
  availabilityWindow,
  clockMinutes,
  slotMinutes,
} from '@/lib/package-pricing';
import type { AvailableSlot } from '@/lib/public-booking';
import { configuration } from './store';
import {
  packageSettings,
  pricePackage,
  validatePackageSchedule,
} from '@/lib/package-config';
import { calculateQuote } from '@/lib/quote';
import {
  extraAvailable,
  appliesTo,
  ordered,
  details,
} from '@/lib/manage-config';
import { adjustedItems } from '@/lib/manage-pricing';
import { publicExtra } from './manage-public';
import { bookingQuestions, checkedAnswers } from '@/lib/manage-questions';
import { validateQuestionFiles } from './question-files';
import { date, text, type PackageRecord } from '@/lib/crm';
import type {
  PublicBooking,
  BookingInput,
  PublicQuote,
} from '@/lib/public-booking';
export async function bookingContext(id: string) {
  const db = rawDb();
  const row = await db
    .prepare(
      'SELECT p.*,b.name AS business_name,b.email AS business_email,b.phone AS business_phone,b.services AS business_services FROM packages p JOIN businesses b ON b.id=p.business_id WHERE p.id=?',
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return null;
  const settings = packageSettings(
    JSON.parse(String(row.settings)),
    String(row.duration),
  );
  if (
    !['Public', 'Private'].includes(settings.status) ||
    !JSON.parse(String(row.business_services)).includes(row.service)
  )
    return null;
  const p: PackageRecord = {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    service: String(row.service),
    price: Number(row.price),
    duration: String(row.duration),
    settings,
  };
  const config = await configuration(row.business_id);
  return {
    p,
    bid: String(row.business_id),
    business: {
      name: String(row.business_name),
      email: String(row.business_email),
      phone: String(row.business_phone),
    },
    ...config,
  };
}
export type BookingContext = NonNullable<
  Awaited<ReturnType<typeof bookingContext>>
>;
export function dateBounds(c: BookingContext) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: String(c.settings.timezone),
  }).format(new Date());
  const earliest = new Date(today + 'T12:00:00Z');
  earliest.setUTCDate(
    earliest.getUTCDate() +
      Math.max(Number(c.settings.noticeDays), c.p.settings!.leadDays),
  );
  const latest = new Date(today + 'T12:00:00Z');
  latest.setUTCDate(
    latest.getUTCDate() + Number(c.settings.maxWindowDays || 1095),
  );
  return {
    today,
    earliestDate: earliest.toISOString().slice(0, 10),
    latestDate: latest.toISOString().slice(0, 10),
  };
}
export async function publicBooking(c: BookingContext): Promise<PublicBooking> {
  const s = c.p.settings!,
    fields = [
      'subheader',
      'showTitle',
      'includedMinutes',
      'minMinutes',
      'maxMinutes',
      'increment',
      'extraHours',
      'extraRate',
      'unitMode',
      'unitCalculation',
      'unitTiers',
      'durationUnit',
      'extraDays',
      'dailyRate',
      'predefinedSlots',
      'slotInterval',
      'unitLabel',
      'minUnits',
      'maxUnits',
      'dateMode',
      'picker',
      'slots',
      'startTime',
      'endTime',
      'days',
      'requireBackdrop',
      'allowSkipBackdrop',
      'includedAddonIds',
      'bookingMode',
    ] as const;
  const publicSettings = Object.fromEntries(fields.map((k) => [k, s[k]]));
  const lengths = durationRules(s),
    units = unitBounds(s);
  Object.assign(publicSettings, {
    includedMinutes: lengths.included,
    minMinutes: lengths.min,
    maxMinutes: lengths.max,
    increment: lengths.increment,
    minUnits: units.min,
    maxUnits: units.max,
  });
  const photos = (
    await rawDb()
      .prepare(
        'SELECT id,alt FROM package_images WHERE package_id=? AND business_id=? ORDER BY is_primary DESC,created_at',
      )
      .bind(c.p.id, c.bid)
      .all<{ id: string; alt: string }>()
  ).results;
  const extras = (kind: string) =>
    c.resources
      .filter(
        (r) => r.kind === kind && extraAvailable(r, c.resources, [c.p.id]),
      )
      .map((r) => publicExtra(r, c.resources, c.p.id));
  const bounds = dateBounds(c),
    preset = ordered(
      c.resources.filter(
        (r) =>
          r.kind === 'booking_presets' && !r.archived && appliesTo(r, [c.p.id]),
      ),
    )[0];
  return {
    business: {
      id: c.bid,
      ...c.business,
      color: String(preset?.data.color || c.settings.color),
      timezone: String(c.settings.timezone),
      hasLogo: Boolean(c.settings.logoVersion),
    },
    package: {
      id: c.p.id,
      name: c.p.name,
      description: c.p.description,
      service: c.p.service,
      price: c.p.price,
      ...publicSettings,
      images: photos,
    } as PublicBooking['package'],
    addons: extras('addons'),
    backdrops: extras('backdrops'),
    presentation: {
      headline: String(preset?.data.headline || c.settings.headline || ''),
      subheading: String(
        preset?.data.subheading || c.settings.subheading || '',
      ),
      background: String(preset?.data.background || ''),
      image:
        preset && details(preset).images[0]
          ? '/api/public-media?' +
            new URLSearchParams({
              business: c.bid,
              item: preset.id,
              id: details(preset).images[0],
              package: c.p.id,
            })
          : '',
    },
    questions: bookingQuestions(c.resources, [c.p.id]),
    privacy: {
      url: String(c.settings.privacyUrl || ''),
      required: Boolean(c.settings.requireConsent),
      text: String(c.settings.consentText || ''),
      sms: String(c.settings.smsDisclaimer || ''),
    },
    earliestDate: bounds.earliestDate,
    latestDate: bounds.latestDate,
  };
}
export function bookingSelection(
  body: Record<string, unknown>,
  c: BookingContext,
): BookingInput {
  const day = date(body.date, 'Event date'),
    time =
      c.p.settings!.dateMode === 'Date Only'
        ? ''
        : text(body.time ?? '', 'Start time', 5, false);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw Error('Choose a valid start time.');
  if (!Array.isArray(body.addonIds) || body.addonIds.length > 30)
    throw Error('Choose up to 30 add-ons.');
  return {
    date: day,
    time,
    minutes: Number(body.minutes),
    units: Number(body.units),
    addonIds: [
      ...new Set(body.addonIds.map((id) => text(id, 'Add-on', 100))),
    ].sort(),
    addonQuantities: body.addonQuantities as Record<string, number> | undefined,
    answers: checkedAnswers(
      body.answers,
      bookingQuestions(c.resources, [c.p.id]),
    ),
    backdropId: text(body.backdropId ?? '', 'Backdrop', 100, false),
    discountCode: text(
      body.discountCode ?? '',
      'Discount code',
      80,
      false,
    ).toUpperCase(),
  };
}
export async function checkBookingDate(
  c: BookingContext,
  day: string,
  minutes = durationRules(c.p.settings!).included,
  extraMinutes = 0,
) {
  const bounds = dateBounds(c);
  const dates = packageDates(
    { minutes, extraMinutes, packageSettings: c.p.settings },
    day,
  );
  if (day < bounds.earliestDate || dates.at(-1)! > bounds.latestDate)
    throw Error(
      'Choose an event date between ' +
        bounds.earliestDate +
        ' and ' +
        bounds.latestDate +
        '.',
    );
  if (
    dates.some((d) => String(c.settings.blackoutDates).split(/\s+/).includes(d))
  )
    throw Error(
      String(
        ordered(
          c.resources.filter(
            (r) =>
              r.kind === 'unavailable_notices' &&
              !r.archived &&
              appliesTo(r, [c.p.id]),
          ),
        )[0]?.data.body ||
          c.settings.unavailableNotice ||
          'This date is unavailable. Please choose another date.',
      ),
    );
  const count =
    Number(c.settings.dailyLimit) > 0
      ? await rawDb()
          .prepare(`SELECT ${capacityConflictSql} AS n`)
          .bind(JSON.stringify(dates), c.bid, '', Number(c.settings.dailyLimit))
          .first<{ n: number }>()
      : null;
  if (Number(c.settings.dailyLimit) > 0 && Number(count?.n) > 0)
    throw Error('This date is fully booked. Please choose another date.');
  return bounds;
}
function pastStart(
  c: BookingContext,
  day: string,
  time: string,
  today: string,
) {
  const now = new Intl.DateTimeFormat('en-GB', {
    timeZone: String(c.settings.timezone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
  return day === today && Boolean(time) && time <= now;
}
export async function bookingQuote(c: BookingContext, input: BookingInput) {
  await validateQuestionFiles(
    c.bid,
    'package:' + c.p.id,
    input.answers || {},
    bookingQuestions(c.resources, [c.p.id]),
  );
  const item = pricePackage(c.p, {
      minutes: input.minutes,
      units: input.units,
    }),
    bounds = await checkBookingDate(c, input.date, item.minutes);
  validatePackageSchedule(
    [item],
    input.date,
    input.time,
    input.backdropId,
    bounds.today,
  );
  if (pastStart(c, input.date, input.time, bounds.today))
    throw Error('Choose a start time in the future.');
  let discountId = '';
  if (input.discountCode) {
    const discount = c.resources.find(
      (r) =>
        r.kind === 'discounts' &&
        !r.archived &&
        String(r.data.code).toUpperCase() === input.discountCode,
    );
    if (!discount) throw Error('That discount code is not valid.');
    discountId = discount.id;
  }
  const quote = calculateQuote([item], c.resources, c.settings, {
    date: input.date,
    time: input.time,
    addonQuantities: input.addonQuantities,
    addonIds: input.addonIds,
    backdropId: input.backdropId,
    discountId,
    miles: 0,
  });
  const adjusted = adjustedItems([item], quote.extras);
  validatePackageSchedule(adjusted, input.date, input.time, input.backdropId);
  await checkBookingDate(c, input.date, item.minutes, adjusted[0].extraMinutes);
  await checkInventory(
    c.bid,
    '',
    { date: input.date, time: input.time, items: adjusted },
    c.resources,
  );
  await checkDiscount(c.bid, '', discountId);
  const view: Omit<PublicQuote, 'token'> = {
    packagePrice: item.price,
    duration: item.duration,
    extras: quote.extras.map((x) => ({
      name: x.name,
      price: x.price,
      included: Boolean(x.included),
    })),
    adjustment: quote.adjustment,
    discount: quote.discount,
    tax: quote.tax,
    taxLabel: quote.taxLabel,
    travel: quote.travel,
    total: quote.total,
    deposit: quote.depositDefault,
    terms: quote.terms,
  };
  return {
    item: adjustedItems([item], quote.extras)[0],
    quote,
    view: {
      ...view,
      token: await digest(JSON.stringify({ package: c.p.id, input, view })),
    },
  };
}
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function availableOptions(
  c: BookingContext,
  day: string,
  minutes: number,
): Promise<AvailableSlot[]> {
  const s = c.p.settings!,
    weekday = new Date(day + 'T12:00:00Z').getUTCDay();
  const window = availabilityWindow(s, weekday),
    bounds = await checkBookingDate(c, day, minutes);
  if (!window.available)
    throw Error('This package is unavailable on that weekday.');
  const units = unitBounds(s).min;
  if (s.dateMode === 'Date Only') {
    validatePackageSchedule(
      [pricePackage(c.p, { minutes, units })],
      day,
      '',
      '',
    );
    await checkInventory(c.bid,'',{date:day,time:'',items:[pricePackage(c.p,{minutes,units})]},c.resources);
    return [];
  }
  let candidates: AvailableSlot[];
  if (s.picker === 'Predefined slots' && s.predefinedSlots.length) {
    candidates = s.predefinedSlots
      .filter((slot) => slot.days.includes(weekday))
      .map((slot) => ({
        time: slot.start,
        minutes: slotMinutes(slot),
        label: slot.label || slot.start + ' – ' + slot.end,
      }));
  } else {
    pricePackage(c.p, { minutes, units });
    const times =
      s.picker === 'Predefined slots'
        ? s.slots.split(/[\s,]+/)
        : Array.from({ length: 1440 }, (_, m) => m)
            .filter(
              (m) =>
                s.picker !== 'Automatic slots' ||
                (m - clockMinutes(window.start)) % s.slotInterval === 0,
            )
            .map(
              (m) =>
                String(Math.floor(m / 60)).padStart(2, '0') +
                ':' +
                String(m % 60).padStart(2, '0'),
            );
    candidates = [...new Set(times)].map((time) => ({
      time,
      minutes,
      label: time,
    }));
  }
  const inventoryAvailable=await publicInventoryAvailability(c.bid,c.resources);
  return candidates
    .filter((slot) => {
      try {
        validatePackageSchedule(
          [pricePackage(c.p, { minutes: slot.minutes, units })],
          day,
          slot.time,
          '',
        );
        return !pastStart(c, day, slot.time, bounds.today)&&inventoryAvailable({date:day,time:slot.time,items:[pricePackage(c.p,{minutes:slot.minutes,units})]});
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}
export async function availableTimes(
  c: BookingContext,
  day: string,
  minutes: number,
) {
  return (await availableOptions(c, day, minutes)).map((s) => s.time);
}
