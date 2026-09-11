import { getChatGPTUser } from '@/app/chatgpt-auth';
import { rawDb } from '@/db/raw';
import { saveAppointment } from '@/db/appointment-scheduling';
import { businessFor, snapshot, operations } from '@/db/store';
import { ownedEvent, validatedExpense, validatedSales } from '@/db/sales';
import { text, date } from '@/lib/crm';
import type { SalesKind } from '@/lib/sales';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 try{
  const user=await getChatGPTUser();if(!user)return response({error:'Sign in first.'},401);
  if(req.headers.get('sec-fetch-site')==='cross-site'||(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin))return response({error:'Invalid origin.'},403);
  const raw=await req.text();if(raw.length>128000)return response({error:'Form is too large.'},413);
  const body=JSON.parse(raw),business=await businessFor(user.userId);if(!business)throw Error('Create your business first.');
  const bid=business.id,db=rawDb(),now=new Date().toISOString();
  if(body.action==='save_record'){
   const kind=body.kind as SalesKind,data=await validatedSales(bid,kind,body.data);
   if(kind==='appointment') await saveAppointment(bid,data,body.id?text(body.id,'Appointment ID'):'',body.id?text(body.updatedAt,'Record version'):'');
   else if(body.id){
    const result=await db.prepare('UPDATE sales_records SET data=?,updated_at=? WHERE id=? AND business_id=? AND kind=? AND updated_at=? AND archived=0').bind(JSON.stringify(data),now,text(body.id,'Record ID'),bid,kind,text(body.updatedAt,'Record version')).run();
    if(!result.meta.changes)return response({error:'Record changed or is unavailable. Refresh before editing again.'},409);
   }else await db.prepare('INSERT INTO sales_records(id,business_id,kind,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),bid,kind,JSON.stringify(data),now,now).run();
  }else if(body.action==='archive_record'){
   if(typeof body.archived!=='boolean')throw Error('Invalid archive choice.');
   // Restored appointments return for review rather than reclaiming an occupied slot.
   if(body.archived===false){const r=await db.prepare("UPDATE sales_records SET archived=0,data=ed_set(data,'$.status','Pending'),updated_at=? WHERE id=? AND business_id=? AND updated_at=? AND kind='appointment' AND archived=1").bind(now,text(body.id,'Record ID'),bid,text(body.updatedAt,'Record version')).run();if(r.meta.changes)return response(await snapshot(user.userId));}
   const result=await db.prepare("UPDATE sales_records SET archived=?,updated_at=? WHERE id=? AND business_id=? AND updated_at=? AND kind NOT IN ('attachment','event_attachment','proposal_link')").bind(body.archived?1:0,now,text(body.id,'Record ID'),bid,text(body.updatedAt,'Record version')).run();
   if(!result.meta.changes)return response({error:'Record changed or is unavailable. Refresh and try again.'},409);
  }else if(body.action==='save_expense'||body.action==='import_expenses'){
   const inputs=body.action==='import_expenses'?body.rows:[body.data];if(!Array.isArray(inputs)||!inputs.length||inputs.length>200)throw Error('Choose between 1 and 200 expenses.');
   if(body.id&&body.action==='import_expenses')throw Error('Invalid import.');
   const validated=[];for(const input of inputs){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid expense.');validated.push(await validatedExpense(bid,input));}
   if(body.id){const existing=await db.prepare("SELECT data FROM resources WHERE id=? AND business_id=? AND kind='expenses' AND archived=0").bind(text(body.id,'Expense ID'),bid).first<{data:string}>();if(!existing)throw Error('Expense unavailable.');const item=validated[0];await db.prepare("UPDATE resources SET name=?,data=?,updated_at=? WHERE id=? AND business_id=? AND kind='expenses'").bind(item.name,JSON.stringify({...JSON.parse(existing.data),...item.data}),now,body.id,bid).run();}
   else await db.batch(validated.map(item=>db.prepare("INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES(?,?,'expenses',?,?,?,?)").bind(crypto.randomUUID(),bid,item.name,JSON.stringify(item.data),now,now)));
  }else if(body.action==='archive_expense'){
   if(typeof body.archived!=='boolean')throw Error('Invalid archive choice.');
   const result=await db.prepare("UPDATE resources SET archived=?,updated_at=? WHERE id=? AND business_id=? AND kind='expenses'").bind(body.archived?1:0,now,text(body.id,'Expense ID'),bid).run();if(!result.meta.changes)throw Error('Expense unavailable.');
  }else if(body.action==='event_meta'){
   const e=await ownedEvent(bid,body.id);const d=body.data||{},patch:Record<string,unknown>={};
   if(d.heat!==undefined){if(!['','Hot','Warm','Cold'].includes(d.heat))throw Error('Choose a valid lead temperature.');patch.heat=d.heat;}
   for(const key of ['review','automationsPaused'])if(d[key]!==undefined){if(typeof d[key]!=='boolean')throw Error('Invalid checkbox.');patch[key]=d[key];}
   if(d.signature!==undefined){if(!['Awaiting','Recorded'].includes(d.signature))throw Error('Invalid signature state.');patch.signature=d.signature;patch.signatureDate=d.signature==='Recorded'?date(d.signatureDate,'Signature date'):'';}
   if(d.notes!==undefined)patch.notes=text(d.notes,'Internal notes',10000,false);
   if(d.expires!==undefined)patch.expires=date(d.expires,'Expiration date',false);
   const writes=[db.prepare("INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?) ON CONFLICT(event_id) DO UPDATE SET data=ed_patch(event_operations.data,excluded.data) WHERE event_operations.business_id=?").bind(e.id,bid,JSON.stringify({sales:patch}),bid)];
   if(d.followUp!==undefined)writes.push(db.prepare('UPDATE events SET follow_up=?,updated_at=? WHERE id=? AND business_id=?').bind(date(d.followUp,'Follow-up date',false),now,e.id,bid));
   await db.batch(writes);
  }else if(body.action==='event_lifecycle'){
   if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>100)throw Error('Select between 1 and 100 records.');
   if(!['Active','Canceled','Postponed','Archived','Spam','Deleted'].includes(body.lifecycle))throw Error('Choose a valid status.');
   const rows=[];for(const id of [...new Set(body.ids)])rows.push(await ownedEvent(bid,id));
   // Restoring a previously confirmed record requires a fresh capacity check through proposal confirmation.
   await db.batch(rows.map(e=>db.prepare("UPDATE events SET lifecycle=?,status=CASE WHEN ?='Active' AND lifecycle!='Active' AND status='confirmed' THEN 'proposal' ELSE status END,updated_at=? WHERE id=? AND business_id=?").bind(body.lifecycle,body.lifecycle,now,e.id,bid)));
  }else if(body.action==='legacy_task_data'){
   const e=await ownedEvent(bid,body.eventId),ops=await operations(e.id,bid),index=(ops.tasks||[]).findIndex((t:{id:string})=>t.id===body.id);if(index<0)throw Error('Task unavailable.');
   const task=await validatedSales(bid,'task',{...body.data,eventId:e.id}) as Record<string,any>,old=ops.tasks[index],next={...old,label:task.title,due:task.due,assignee:task.assignee,notes:task.notes,done:task.done};
   const r=await db.prepare('UPDATE event_operations SET data=ed_set(data,?,ed_json(?)) WHERE event_id=? AND business_id=? AND ed_json(ed_text(data,?))=ed_json(?)').bind(`$.tasks[${index}]`,JSON.stringify(next),e.id,bid,`$.tasks[${index}]`,JSON.stringify(old)).run();if(!r.meta.changes)return response({error:'Task changed. Refresh before editing again.'},409);
  }else if(body.action==='legacy_task'){
   const e=await ownedEvent(bid,body.eventId),ops=await operations(e.id,bid),index=(ops.tasks||[]).findIndex((t:{id:string})=>t.id===body.id);if(index<0)throw Error('Task unavailable.');
   if(typeof body.done!=='boolean')throw Error('Invalid task status.');
   await db.prepare("UPDATE event_operations SET data=ed_set(data,?,ed_json(?)) WHERE event_id=? AND business_id=? AND ed_text(data,?)=?").bind(`$.tasks[${index}].done`,JSON.stringify(body.done),e.id,bid,`$.tasks[${index}].id`,body.id).run();
  }else throw Error('Unknown action.');
  return response(await snapshot(user.userId));
 }catch(e){const message=e instanceof Error?e.message:'Unable to save.';if(e instanceof Error&&e.name==='AppointmentConflict')return response({error:message},409);if(message==='Database unavailable.'){console.error('Sales database operation failed');return response({error:'Unable to save right now. Please try again.'},503);}return response({error:message},400);}
}
