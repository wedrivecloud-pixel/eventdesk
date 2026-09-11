import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.QA_BASE_URL||'http://localhost:3100';
const enabled=process.env.SEED_SYNTHETIC_DATA==='true';
const call=async(path:string,cookie='',body?:unknown)=>{
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {response,data};
};
test('verified accounts, forged headers, tenant isolation and event workflow',{skip:!enabled},async()=>{
 const live=await call('/api/health/live');assert.equal(live.response.status,200);
 const forged=await fetch(base+'/api/crm',{headers:{'oai-authenticated-user-id':'qa-owner','oai-authenticated-user-email':'qa-owner@example.test'}});
 assert.equal(forged.status,401);
 const signin=await call('/api/auth/sign-in/email','',{email:'qa-owner@example.test',password:process.env.SEED_PASSWORD});
 assert.equal(signin.response.status,200,JSON.stringify(signin.data));
 const cookie=signin.response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert.ok(cookie.includes('eventdesk'));
 const own=await call('/api/crm',cookie);assert.equal(own.response.status,200,JSON.stringify(own.data));
 assert.equal(own.data.business.id,'qa-business');assert.ok(own.data.packages.some((p:any)=>p.id==='qa-package'));
 assert.ok(!own.data.packages.some((p:any)=>p.id==='qa-other-package'));
 const wrong=await call('/api/crm',cookie,{action:'save_package',id:'qa-other-package',name:'Forbidden change',service:'Photobooths',price:10000,duration:'4 hours'});
 assert.equal(wrong.response.status,404);
 const cross=await fetch(base+'/api/crm',{method:'POST',headers:{Origin:'https://evil.example',Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
 const title='QA lead '+Date.now();
 const created=await call('/api/crm',cookie,{action:'save_event',title,client:'Synthetic Client',email:'client@example.test',date:'2027-05-14',time:'17:00',packageIds:['qa-package'],deposit:0});
 assert.equal(created.response.status,200,JSON.stringify(created.data));
 const event=created.data.events.find((e:any)=>e.title===title);assert.ok(event?.id);assert.equal(event.status,'lead');
 const proposal=await call('/api/crm',cookie,{action:'advance_event',id:event.id,status:'proposal'});
 assert.equal(proposal.response.status,200,JSON.stringify(proposal.data));
 for(const [path,status] of [['/api/account',200],['/api/sales',405],['/api/manage',405],['/api/proposal?event='+event.id,405]] as const){
  const result=await call(path,cookie);assert.equal(result.response.status,status,`${path}: ${JSON.stringify(result.data)}`);
 }
 const signedOut=await call('/api/auth/sign-out',cookie,{});assert.equal(signedOut.response.status,200);
 assert.equal((await call('/api/crm',cookie)).response.status,401);
});
