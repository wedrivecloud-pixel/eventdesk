import { rawDb } from './raw';
import { details, appliesTo } from '@/lib/manage-config';
import { eventWindow } from '@/lib/staffing';
import { eventEndSql } from './availability';
import type { Resource } from '@/lib/settings';
import type { LineItem } from '@/lib/crm';
export function inventoryGuard(
  bid: unknown,
  id: unknown,
  e: { date: string; time: string; items: LineItem[] },
  resources: Resource[],
) {
  const rules = resources
    .filter(
      (r) =>
        r.kind === 'inventory_rules' &&
        !r.archived &&
        appliesTo(
          r,
          e.items.map((p) => p.id),
        ),
    )
    .map((r) => ({
      id: r.id,
      capacity: Number(r.data.capacity || 1),
      ids: details(r).packageMode === 'all' ? [] : details(r).packageIds,
    }));
  const w = eventWindow(e),
    start = w.start / 86400000 + 2440587.5,
    end = w.end / 86400000 + 2440587.5;
  const allDay =
      "(x.time='' OR EXISTS(SELECT 1 FROM ed_each(x.items) j WHERE ed_text(j.value,'$.packageSettings.dateMode')='Date Only'))",
    begins = `CASE WHEN ${allDay} THEN ed_julian(x.date) ELSE ed_julian(x.date||'T'||x.time) END`,
    ends = `CASE WHEN ${allDay} THEN ed_julian(${eventEndSql})+1 ELSE (${begins})+COALESCE((SELECT MAX(COALESCE(ed_number(j.value,'$.minutes'),240)+COALESCE(ed_number(j.value,'$.extraMinutes'),0)) FROM ed_each(x.items) j),240)/1440.0 END`;
  return {
    sql: `EXISTS(WITH rules AS (SELECT ed_text(value,'$.id') AS id,ed_number(value,'$.capacity') AS capacity,ed_text(value,'$.ids') AS ids FROM ed_each(?)), ranges AS (SELECT r.id,${begins} AS first,${ends} AS last FROM rules r JOIN events x ON x.business_id=? AND x.id!=? AND x.status='confirmed' AND x.lifecycle='Active' WHERE ed_array_length(r.ids)=0 OR EXISTS(SELECT 1 FROM ed_each(x.items) p JOIN ed_each(r.ids) ids ON ed_text(p.value,'$.id')=ids.value)), points AS (SELECT id,? AS point FROM rules UNION SELECT id,first FROM ranges WHERE first>=? AND first<?) SELECT 1 FROM points p JOIN rules r ON r.id=p.id WHERE (SELECT COUNT(*) FROM ranges x WHERE x.id=p.id AND x.first<=p.point AND x.last>p.point)>=r.capacity)`,
    args: [JSON.stringify(rules), bid, id, start, start, end],
  };
}
export async function checkInventory(
  bid: unknown,
  id: unknown,
  e: { date: string; time: string; items: LineItem[] },
  resources: Resource[],
) {
  const g = inventoryGuard(bid, id, e, resources),
    r = await rawDb()
      .prepare(`SELECT ${g.sql} AS unavailable`)
      .bind(...g.args)
      .first<{ unavailable: number }>();
  if (r?.unavailable)
    throw Error(
      'Shared package availability is full for this time. Choose another time.',
    );
}
export async function publicInventoryAvailability(bid:string,resources:Resource[]){
 const rules=resources.filter(r=>r.kind==='inventory_rules'&&!r.archived);
 if(!rules.length)return (_event:{date:string;time:string;items:LineItem[]})=>true;
 const rows=(await rawDb().prepare("SELECT date,time,items FROM events WHERE business_id=? AND status='confirmed' AND lifecycle='Active'").bind(bid).all<{date:string;time:string;items:string}>()).results.map(e=>({...e,items:JSON.parse(e.items) as LineItem[]}));
 const groups=rules.map(r=>({r,windows:rows.filter(e=>appliesTo(r,e.items.map(p=>p.id))).map(eventWindow)}));
 return (event:{date:string;time:string;items:LineItem[]})=>{const w=eventWindow(event);return groups.every(({r,windows})=>{if(!appliesTo(r,event.items.map(p=>p.id)))return true;const ranges=windows.filter(x=>x.start<w.end&&x.end>w.start),points=[w.start,...ranges.map(x=>x.start).filter(t=>t>=w.start&&t<w.end)];return points.every(t=>ranges.filter(x=>x.start<=t&&x.end>t).length<Number(r.data.capacity||1));});};
}
export function discountGuard(
  bid: unknown,
  eventId: unknown,
  discountId: string,
) {
  return rawDb()
    .prepare(
      `SELECT CASE WHEN COALESCE((SELECT ed_number(data,'$.maxRedemptions') FROM resources WHERE id=? AND business_id=? AND kind='discounts'),0)<=0 OR (SELECT COUNT(*) FROM event_operations o JOIN events e ON e.id=o.event_id AND e.business_id=o.business_id WHERE o.business_id=? AND o.event_id!=? AND ed_text(o.data,'$.quote.discountId')=? AND e.lifecycle NOT IN ('Deleted','Spam','Canceled')) < (SELECT ed_number(data,'$.maxRedemptions') FROM resources WHERE id=? AND business_id=?) THEN 1 ELSE ed_raise('Discount redemption limit reached') END`,
    )
    .bind(discountId, bid, bid, eventId, discountId, discountId, bid);
}
export async function checkDiscount(
  bid: unknown,
  eventId: unknown,
  discountId: string,
) {
  if (!discountId) return;
  try {
    await discountGuard(bid, eventId, discountId).first();
  } catch {
    throw Error('This discount code has reached its redemption limit.');
  }
}
