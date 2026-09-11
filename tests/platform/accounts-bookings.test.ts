import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { getPool,closeDatabase } from '../../db/pool';
const enabled=process.env.SEED_SYNTHETIC_DATA==='true';
const base=process.env.QA_BASE_URL||'http://localhost:3100';

test('new owner onboarding, profile persistence and direct booking creation',{skip:!enabled},async()=>{
 assert.ok(['development','staging'].includes(process.env.APP_ENV||''));
 const db=getPool(),uid='qa-temporary-'+randomUUID(),email=uid+'@example.test';let cookie='';
 const call=async(path:string,body?:unknown)=>{
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {response,data:await response.json()};
 };
 try{
  // Verified synthetic fixture only; real SMTP signup/verification remains a release gate.
  await db.query('INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true)',[uid,'Synthetic new owner',email]);
  await db.query('INSERT INTO auth_account(id,account_id,provider_id,user_id,password) VALUES($1,$2,$3,$4,$5)',[uid+'-account',uid,'credential',uid,await hashPassword(process.env.SEED_PASSWORD!)]);
  const login=await call('/api/auth/sign-in/email',{email,password:process.env.SEED_PASSWORD});assert.equal(login.response.status,200);
  cookie=login.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  assert.equal((await call('/api/account')).response.status,404);
  const made=await call('/api/crm',{action:'save_business',name:'Synthetic new business',email,phone:'',services:['Photobooths','DJs']});assert.equal(made.response.status,200);
  assert.equal(made.data.business.email,email);const bid=made.data.business.id;assert.ok(bid);
  assert.equal((await db.query('SELECT owner_id FROM businesses WHERE id=$1',[bid])).rows[0].owner_id,uid);
  const pack=await call('/api/crm',{action:'save_package',name:'Synthetic starter package',service:'Photobooths',price:30000,duration:'4 hours',description:'Synthetic onboarding test'});assert.equal(pack.response.status,200);
  const pid=pack.data.packages.find((p:any)=>p.name==='Synthetic starter package')?.id;assert.ok(pid);
  const event={action:'save_event',initialStatus:'confirmed',title:'Direct booking QA',client:'Synthetic client',email:'client@example.test',date:'2032-11-15',time:'17:00',venue:'Synthetic hall',packageIds:[pid],deposit:5000};
  assert.equal((await call('/api/crm',{...event,time:''})).response.status,400,'Bookings need a start time');
  assert.equal((await call('/api/crm',{...event,bookingPreview:true})).response.status,400,'Public preview cannot confirm a booking');
  const booking=await call('/api/crm',event);assert.equal(booking.response.status,200,JSON.stringify(booking.data));
  const saved=booking.data.events.find((e:any)=>e.title===event.title);assert.equal(saved.status,'confirmed');assert.equal(saved.total,30000);
  assert.equal((await call('/api/crm',{...event,id:saved.id,date:'2032-11-16'})).response.status,400,'Confirmed schedule changes require reopening');
  const account=await call('/api/account');assert.equal(account.response.status,200);
  const profile={...account.data.profile,firstName:'Synthetic',lastName:'Owner',contactEmail:email,dailyDigest:true};
  const updated=await call('/api/account',{action:'save_profile',profile,updatedAt:account.data.updatedAt});assert.equal(updated.response.status,200);
  assert.equal((await call('/api/account')).data.profile.firstName,'Synthetic');
  assert.equal((await call('/api/account',{action:'save_profile',profile,updatedAt:account.data.updatedAt})).response.status,409);
  const draft=await call('/api/account',{action:'save_support_draft',subject:'Synthetic request',body:'Do not send',updatedAt:updated.data.updatedAt});assert.equal(draft.response.status,200);assert.equal(draft.data.supportDraft.body,'Do not send');
  assert.equal((await call('/api/crm',{action:'save_package',id:'qa-other-package',name:'Forbidden',service:'Photobooths',price:10000,duration:'4 hours'})).response.status,404);
 }finally{
  const row=(await db.query('SELECT id FROM businesses WHERE owner_id=$1',[uid])).rows[0];
  if(row){
   for(const table of ['event_operations','payments','package_images','sales_records','resources','events','packages','business_settings'])await db.query(`DELETE FROM ${table} WHERE business_id=$1`,[row.id]);
   await db.query('DELETE FROM businesses WHERE id=$1 AND owner_id=$2',[row.id,uid]);
  }
  await db.query('DELETE FROM auth_user WHERE id=$1',[uid]);await closeDatabase();
 }
});
