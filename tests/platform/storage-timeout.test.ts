import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { files,s3 } from '../../server/storage';

test('readiness storage probe aborts when the upstream stops responding',async()=>{
 const server=http.createServer(()=>{});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const values={WASABI_ENDPOINT:`http://127.0.0.1:${(server.address() as any).port}`,WASABI_REGION:'us-east-1',WASABI_BUCKET:'test',WASABI_ACCESS_KEY_ID:'fixture',WASABI_SECRET_ACCESS_KEY:'fixture'};
 const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
 try{
  const start=Date.now();await assert.rejects(files.health());
  assert.ok(Date.now()-start<8000,'A stalled bucket must not hang readiness indefinitely');
 }finally{
  s3().destroy();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  for(const [k,v] of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
