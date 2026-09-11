import { validatePackageSchedule } from '@/lib/package-config';
import { eventDates } from '@/lib/package-pricing';
import type { LineItem } from '@/lib/crm';
import type { Resource, Settings } from '@/lib/settings';
import { validateStaffAssignment, staffConflictGuard } from './staffing';
import { inventoryGuard } from './manage-guards';
import { capacityConflictSql } from './availability';

// Direct bookings and proposal confirmations must obey the same rules.
export async function bookingConfirmationGuard(
  bid: unknown,
  id: unknown,
  event: { date: string; time: string; items: LineItem[] },
  staffIds: string[],
  backdropId: string,
  config: { settings: Settings; resources: Resource[] },
) {
  if (!event.items.length) throw Error('Select a package for this booking.');
  const { settings, resources } = config;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: String(settings.timezone),
  }).format(new Date());
  validatePackageSchedule(
    event.items,
    event.date,
    event.time,
    backdropId,
    today,
  );
  await validateStaffAssignment(bid, id, event, staffIds);
  const needed = event.items.reduce(
    (n, p) => n + (p.packageSettings?.requiredStaff || 0),
    0,
  );
  if (staffIds.length < needed)
    throw Error(
      'Assign at least ' + needed + ' staff before confirming this booking.',
    );
  const earliest = new Date(today + 'T12:00:00Z');
  earliest.setUTCDate(earliest.getUTCDate() + Number(settings.noticeDays));
  if (event.date < earliest.toISOString().slice(0, 10))
    throw Error('This date does not meet your minimum booking notice.');
  const dates = eventDates(event.items, event.date);
  if (
    dates.some((d) => String(settings.blackoutDates).split(/\s+/).includes(d))
  )
    throw Error('This date is marked unavailable.');
  const limit = Number(settings.dailyLimit);
  const staff = staffConflictGuard(bid, id, event, staffIds);
  const inventory = inventoryGuard(bid, id, event, resources);
  // Evaluated inside the write to prevent concurrent bookings claiming capacity.
  return {
    sql: `((? != 0 AND ${capacityConflictSql}) OR ${staff.sql} OR ${inventory.sql})`,
    args: [
      limit,
      JSON.stringify(dates),
      bid,
      id,
      limit,
      ...staff.args,
      ...inventory.args,
    ],
  };
}
