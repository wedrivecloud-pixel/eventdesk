import { rawDb } from './raw';
import { staffId } from './sales';
import { eventWindow } from '@/lib/staffing';
import type { LineItem } from '@/lib/crm';
import { scheduleGuard } from './schedule-guards';
// Recheck inside confirmation writes so bookings and appointments cannot claim the same staff.
export function staffConflictGuard(
  bid: unknown,
  id: unknown,
  e: { date: string; time: string; items: LineItem[] },
  ids: string[],
) {
  return scheduleGuard(bid, id, eventWindow(e), ids);
}
export async function validateStaffAssignment(
  bid: unknown,
  eventId: unknown,
  e: { date: string; time: string; items: LineItem[] },
  ids: string[],
) {
  for (const id of ids) await staffId(bid, id);
  if (!ids.length) return;
  const guard = staffConflictGuard(bid, eventId, e, ids),
    result = await rawDb()
      .prepare(`SELECT ${guard.sql} AS conflict`)
      .bind(...guard.args)
      .first<{ conflict: number }>();
  if (result?.conflict)
    throw Error(
      'Assigned staff are unavailable: check weekly hours, approved time off, appointments and confirmed bookings. Choose available staff.',
    );
}
