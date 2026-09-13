import { rawDb } from './raw';
import { operations } from './store';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { type EventRecord, type Payment } from '@/lib/crm';
export async function proposalAccess(id: string, token = '') {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return null;
  const row = await rawDb()
    .prepare(
      "SELECT e.*,b.owner_id,b.name AS business_name,b.email AS business_email,b.phone AS business_phone FROM events e JOIN businesses b ON b.id=e.business_id WHERE e.id=? AND e.status IN ('proposal','confirmed')",
    )
    .bind(id)
    .first<
      Omit<EventRecord, 'items' | 'operations'> & {
        items: string;
        owner_id: string;
        business_id: string;
        business_name: string;
        business_email: string;
        business_phone: string;
      }
    >();
  if (!row) return null;
  const user = await getChatGPTUser(),
    owner = user?.userId === row.owner_id;
  if (!owner) {
    if (row.lifecycle !== 'Active' || !/^[-_a-zA-Z0-9]{43}$/.test(token))
      return null;
    const share = await rawDb()
      .prepare(
        "SELECT id FROM sales_records WHERE id=? AND business_id=? AND kind='proposal_link' AND archived=0 AND ed_text(data,'$.token')=?",
      )
      .bind('proposal-link:' + id, row.business_id, token)
      .first();
    if (!share) return null;
  }
  const e = {
    ...row,
    items: JSON.parse(row.items),
    operations: await operations(id, row.business_id),
  } as EventRecord;
  const payments = (
    await rawDb()
      .prepare(
        "SELECT id,event_id,amount,tip,method,date FROM payments WHERE event_id=? AND business_id=? AND voided_at='' ORDER BY date",
      )
      .bind(id, row.business_id)
      .all<Payment>()
  ).results;
  return {
    event: e,
    payments,
    bid: String(row.business_id),
    owner,
    business: {
      name: e.operations?.brand?.name ?? String(row.business_name),
      email: e.operations?.brand?.email ?? String(row.business_email),
      phone: e.operations?.brand?.phone ?? String(row.business_phone || ''),
      address: e.operations?.brand?.address || '',
      website: e.operations?.brand?.website || '',
    },
  };
}
