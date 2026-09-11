import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { verifyRelease } from '../../scripts/verify-release.mjs';

test('deployment verification rejects an older healthy release',async()=>{
 const expected='a'.repeat(40);let commit='b'.repeat(40);
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ready',commit}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
  await assert.rejects(verifyRelease({url,sha:expected,attempts:1}),/expected release/);
  commit=expected;await verifyRelease({url,sha:expected,attempts:1});
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
