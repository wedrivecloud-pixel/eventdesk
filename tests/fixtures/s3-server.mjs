// Ephemeral loopback-only S3 protocol fixture for application authorization tests.
// This is not Wasabi and is never deployed. Provider verification is a separate gate.
import http from 'node:http';
import { createHash } from 'node:crypto';
const objects=new Map();
const server=http.createServer(async(req,res)=>{
 if(!req.headers.authorization?.includes('Credential=test-access/')){res.statusCode=403;res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1'),parts=url.pathname.slice(1).split('/'),bucket=parts.shift(),key=decodeURIComponent(parts.join('/'));
 if(bucket!=='eventdesk-qa'){res.statusCode=404;res.end();return;}
 if(req.method==='HEAD'&&!key){res.statusCode=200;res.end();return;}
 if(req.method==='PUT'){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>11*1024*1024){res.statusCode=413;res.end();req.destroy();return;}chunks.push(chunk);}
  const body=Buffer.concat(chunks),etag=createHash('md5').update(body).digest('hex');
  objects.set(key,{body,type:req.headers['content-type'],etag});res.setHeader('ETag',`"${etag}"`);res.statusCode=200;res.end();return;
 }
 if(req.method==='DELETE'){objects.delete(key);res.statusCode=204;res.end();return;}
 if(req.method==='POST'&&url.searchParams.has('delete')){
  let body='';for await(const chunk of req)body+=chunk;
  const keys=[...body.matchAll(/<Key>(.*?)<\/Key>/g)].map(m=>m[1]);for(const k of keys)objects.delete(k);
  res.setHeader('Content-Type','application/xml');res.end('<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>');return;
 }
 const object=objects.get(key);if(!object){res.statusCode=404;res.setHeader('Content-Type','application/xml');res.end('<Error><Code>NoSuchKey</Code></Error>');return;}
 res.setHeader('Content-Length',object.body.length);res.setHeader('Content-Type',object.type||'application/octet-stream');res.setHeader('ETag',`"${object.etag}"`);
 res.end(req.method==='HEAD'?undefined:object.body);
});
server.listen(3900,'127.0.0.1',()=>console.log('Ephemeral S3 test fixture listening on loopback port 3900.'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
