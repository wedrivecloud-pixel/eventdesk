import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

test('object migration streams bytes, verifies checksums and refuses overwrites',async()=>{
 const original=Buffer.from('Synthetic migration bytes\n');
 const objects=new Map<string,{body:Buffer,type:string}>([['source/qa/photo.txt',{body:original,type:'text/plain'}]]);
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://localhost'),key=decodeURIComponent(url.pathname.slice(1));
  if(req.method==='GET'&&url.searchParams.get('list-type')==='2'){
   res.setHeader('Content-Type','application/xml');
   res.end(`<ListBucketResult><Name>source</Name><IsTruncated>false</IsTruncated><Contents><Key>qa/photo.txt</Key><Size>${original.length}</Size></Contents></ListBucketResult>`);return;
  }
  if(req.method==='PUT'){
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);
   objects.set(key,{body:Buffer.concat(chunks),type:String(req.headers['content-type'])});res.end();return;
  }
  const object=objects.get(key);
  if(!object){res.statusCode=404;res.end('<Error><Code>NoSuchKey</Code></Error>');return;}
  res.setHeader('Content-Length',object.body.length);res.setHeader('Content-Type',object.type);
  res.end(req.method==='HEAD'?undefined:object.body);
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const endpoint=`http://127.0.0.1:${(server.address() as any).port}`,folder=await fs.mkdtemp(path.join(os.tmpdir(),'eventdesk-migration-test-'));
 const run=()=>new Promise<number|null>((resolve,reject)=>{
  const child=spawn(process.execPath,[path.resolve('scripts/migrate-objects.mjs')],{cwd:folder,stdio:'ignore',env:{...process.env,
   OBJECT_MIGRATION_ENABLED:'true',SOURCE_S3_ENDPOINT:endpoint,SOURCE_S3_BUCKET:'source',SOURCE_S3_ACCESS_KEY_ID:'fixture',SOURCE_S3_SECRET_ACCESS_KEY:'fixture',
   WASABI_ENDPOINT:endpoint,WASABI_BUCKET:'target',WASABI_REGION:'us-east-1',WASABI_ACCESS_KEY_ID:'fixture',WASABI_SECRET_ACCESS_KEY:'fixture',
  }});child.once('error',reject);child.once('exit',resolve);
 });
 try{
  assert.equal(await run(),0);
  assert.deepEqual(objects.get('target/qa/photo.txt'),objects.get('source/qa/photo.txt'));
  const manifest=JSON.parse(await fs.readFile(path.join(folder,'artifacts/object-migration.json'),'utf8'));
  assert.deepEqual(manifest,[{key:'qa/photo.txt',size:original.length,sha256:createHash('sha256').update(original).digest('hex')}]);
  assert.notEqual(await run(),0,'An existing target must require reconciliation');
  assert.deepEqual(objects.get('source/qa/photo.txt')?.body,original,'Source remains intact');
 }finally{
  server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  // Remove only the exact generated files and empty temporary directories.
  await fs.unlink(path.join(folder,'artifacts/object-migration.json')).catch(()=>{});
  await fs.rmdir(path.join(folder,'artifacts')).catch(()=>{});await fs.rmdir(folder);
 }
});
