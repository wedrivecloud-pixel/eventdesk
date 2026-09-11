import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.QA_BASE_URL||'http://localhost:3100';
test('public proposal, invoice, attachments, tenant denial and revocation',{skip:process.env.SEED_SYNTHETIC_DATA!=='true'},async()=>{
 const call=async(path:string,cookie='',body?:unknown)=>{
  const res=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {res,data};
 };
 const signIn=async(email:string)=>{
  const r=await call('/api/auth/sign-in/email','',{email,password:process.env.SEED_PASSWORD});assert.equal(r.res.status,200);
  return r.res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 };
 const owner=await signIn('qa-owner@example.test'),other=await signIn('qa-other@example.test');
 const title='QA proposal '+Date.now(),privateNote='INTERNAL-ONLY-NOTE-'+Date.now();
 const made=await call('/api/crm',owner,{action:'save_event',title,client:'Synthetic Client',email:'client@example.test',date:'2032-05-14',time:'17:00',packageIds:['qa-package'],deposit:10000,notes:privateNote});
 assert.equal(made.res.status,200);const event=made.data.events.find((e:any)=>e.title===title);assert.ok(event);
 try{
  assert.equal((await call('/api/crm',owner,{action:'advance_event',id:event.id,status:'proposal'})).res.status,200);
  const shared=await call('/api/proposal',owner,{action:'share_link',eventId:event.id});assert.equal(shared.res.status,200);
  const path=shared.data.path,token=new URL(path,base).searchParams.get('token');
  assert.equal((await call('/proposal/'+event.id,other)).res.status,404);
  assert.equal((await call('/api/proposal',other,{action:'share_link',eventId:event.id})).res.status,404);
  assert.equal((await call('/api/proposal/options','',{action:'quote',eventId:event.id,token:'invalid'})).res.status,404);
  const uploadPath='/api/event-attachments?event='+event.id+'&name=QA%20document&filename=qa.pdf';
  const upload=await fetch(base+uploadPath,{method:'PUT',headers:{Origin:base,Cookie:owner,'Content-Type':'application/pdf'},body:'%PDF-1.7\nSynthetic QA document\n%%EOF'});
  assert.equal(upload.status,200);const file=(await upload.json()).files[0];assert.ok(file);
  const filePath='/api/event-attachments?event='+event.id+'&id='+file.id;
  assert.equal((await call(filePath,owner)).res.status,200);
  assert.equal((await call(filePath,other)).res.status,404);
  assert.equal((await call(filePath+'&token='+token)).res.status,404,'Files start private');
  const visible=await call('/api/event-attachments',owner,{action:'update',eventId:event.id,id:file.id,name:'Client QA document',clientView:true,staffView:true,updatedAt:file.updatedAt});
  assert.equal(visible.res.status,200);
  const download=await call(filePath+'&token='+token);assert.equal(download.res.status,200);assert.ok(download.data.startsWith('%PDF-'));assert.match(download.res.headers.get('content-disposition')||'',/^attachment/);
  for(const suffix of ['', '&view=invoice']){
   const rendered=await call(path+suffix);assert.equal(rendered.res.status,200,`Proposal render ${suffix}`);
   assert.ok(rendered.data.includes(title));assert.ok(rendered.data.includes('QA Photo Booth'));
   assert.ok(rendered.data.includes('Client QA document'));assert.ok(!rendered.data.includes(privateNote));
  }
  const invalid=await fetch(base+uploadPath,{method:'PUT',headers:{Origin:base,Cookie:owner,'Content-Type':'application/pdf'},body:'<script>invalid</script>'});assert.equal(invalid.status,400);
  assert.equal((await call('/api/proposal',owner,{action:'revoke_link',eventId:event.id})).res.status,200);
  assert.equal((await call(path)).res.status,404);assert.equal((await call(filePath+'&token='+token)).res.status,404);
  const reshared=await call('/api/proposal',owner,{action:'share_link',eventId:event.id});assert.notEqual(reshared.data.path,path);
  assert.equal((await call('/api/sales',owner,{action:'event_lifecycle',ids:[event.id],lifecycle:'Deleted'})).res.status,200);
  assert.equal((await call(reshared.data.path)).res.status,404,'Deleting a proposal revokes client access');
 }finally{
  await call('/api/sales',owner,{action:'event_lifecycle',ids:[event.id],lifecycle:'Deleted'});
  await call('/api/auth/sign-out',owner,{});await call('/api/auth/sign-out',other,{});
 }
});
