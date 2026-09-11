import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs/promises';
const enabled=process.env.SEED_SYNTHETIC_DATA==='true';
const base=process.env.QA_BASE_URL||'http://localhost:3100';

test('HTTP safety headers, body limits and compressed build assets',{skip:!enabled},async()=>{
 const live=await fetch(base+'/api/health/live');assert.equal(live.status,200);
 assert.equal(live.headers.get('x-content-type-options'),'nosniff');assert.ok(live.headers.get('x-request-id'));
 assert.match(live.headers.get('content-security-policy')||'',/object-src 'none'/);
 const preview=await fetch(base+'/booking-preview',{redirect:'manual'});
 assert.match(preview.headers.get('content-security-policy')||'',/frame-ancestors 'self'/,'Owner booking preview must not be embeddable');
 const schedule=await fetch(base+'/schedule/nonexistent',{redirect:'manual'});
 assert.match(schedule.headers.get('content-security-policy')||'',/frame-ancestors https:/,'Public scheduling supports website embedding');
 const noOrigin=await fetch(base+'/api/crm',{method:'POST',body:'{}'});assert.equal(noOrigin.status,403);
 const oversized=await fetch(base+'/api/crm',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({text:'a'.repeat(66000)})});assert.equal(oversized.status,413);
 const files=(await fs.readdir('dist/standalone/dist/client/_next/static',{recursive:true})).map(file=>file.replaceAll('\\','/'));
 const asset=files.find(f=>f.endsWith('.js.br'));assert.ok(asset,'Build must generate Brotli JS');
 const response=await fetch(base+'/_next/static/'+asset.slice(0,-3),{headers:{'Accept-Encoding':'br'}});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-encoding'),'br');assert.equal(response.headers.get('vary'),'Accept-Encoding');
 assert.match(response.headers.get('cache-control')||'',/immutable/);
 const original=await fs.readFile('dist/standalone/dist/client/_next/static/'+asset.slice(0,-3));
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),original,'Downloaded compressed script must decode to exact build bytes');
});

test('Cloudflare origin gate rejects spoofed headers and logs omit query secrets',{skip:!enabled,timeout:30000},async()=>{
 const probe=http.createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const port=(probe.address() as any).port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
 const origin=`http://localhost:${port}`,secret=randomBytes(32).toString('hex');let logs='';
 const child=spawn(process.execPath,['dist/standalone/server.js'],{env:{...process.env,APP_ENV:'development',APP_URL:origin,PORT:String(port),PROXY_MODE:'cloudflare',EDGE_SHARED_SECRET:secret},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 try{
  let started=false;for(let i=0;i<80;i++){
   try{if((await fetch(origin+'/api/health/live')).ok){started=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,100));
  }assert.ok(started,'Hardened server starts');
  assert.equal((await fetch(origin+'/api/crm',{headers:{'cf-connecting-ip':'1.2.3.4','x-forwarded-for':'1.2.3.4'}})).status,403);
  assert.equal((await fetch(origin+'/api/crm',{headers:{'x-eventdesk-edge-secret':secret,'cf-connecting-ip':'invalid'}})).status,400);
  const testIp='2001:db8:'+randomBytes(12).toString('hex').match(/.{4}/g)!.join(':');
  const trusted={'x-eventdesk-edge-secret':secret,'cf-connecting-ip':testIp,'oai-authenticated-user-id':'qa-owner','x-eventdesk-client-ip':'forged'};
  assert.equal((await fetch(origin+'/api/crm',{headers:trusted})).status,401,'Even trusted edge requests need an authenticated session');
  assert.equal((await fetch(origin+'/api/health/live/extra')).status,403,'Only exact health routes bypass the edge gate');
  assert.equal((await fetch(origin+'/api/health/live?token=DO-NOT-LOG-THIS')).status,200);
  for(let attempt=0;attempt<9;attempt++){
   const response=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',headers:{...trusted,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'rate-probe@example.test',password:'deliberately-wrong-password'})});
   assert.equal(response.status,attempt<8?401:429,`Authentication attempt ${attempt+1}`);
   if(attempt===8)assert.ok(Number(response.headers.get('retry-after'))>0);
  }
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.ok(!logs.includes('DO-NOT-LOG-THIS'));assert.ok(!logs.includes(secret));
 }finally{child.kill('SIGTERM');await new Promise<void>(resolve=>child.exitCode!==null?resolve():child.once('exit',()=>resolve()));}
});
