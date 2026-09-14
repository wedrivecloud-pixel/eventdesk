import { rawDb } from './raw';
import { text } from '@/lib/crm';

export async function voidRecordedPayment(
  businessId: unknown,
  eventId: string,
  paymentId: unknown,
  reason: unknown,
  actor: { userId: string; displayName: string },
) {
  const id = text(paymentId, 'Payment ID', 100);
  const note = text(reason, 'Reason for voiding', 500);
  const db = rawDb();
  // Preserve the amount, tip and original receipt. Only the first correction wins.
  const result = await db
    .prepare(
      "UPDATE payments SET voided_at=?,voided_by=?,voided_by_name=?,void_reason=? WHERE id=? AND event_id=? AND business_id=? AND voided_at=''",
    )
    .bind(
      new Date().toISOString(),
      actor.userId,
      actor.displayName.slice(0, 200),
      note,
      id,
      eventId,
      businessId,
    )
    .run();
  if (result.meta.changes) return 'voided';
  const existing = await db
    .prepare(
      'SELECT id FROM payments WHERE id=? AND event_id=? AND business_id=?',
    )
    .bind(id, eventId, businessId)
    .first();
  return existing ? 'already_voided' : 'not_found';
}
