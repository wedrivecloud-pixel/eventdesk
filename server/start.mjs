import { join } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { existsSync,statSync,createReadStream } from 'node:fs';

const origin=new URL(process.env.APP_URL||'http://localhost:3000');
if(!['development','staging','production'].includes(process.env.APP_ENV||''))throw Error('APP_ENV is required.');
if(!process.env.APP_URL||!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('APP_URL must be an origin without a path or credentials.');
if(process.env.APP_ENV!=='development'&&origin.protocol!=='https:')throw Error('HTTPS APP_URL required.');
if(!process.env.DATABASE_URL||!process.env.BETTER_AUTH_SECRET||process.env.BETTER_AUTH_SECRET.length<32)throw Error('Database and authentication configuration required.');
const database=new URL(process.env.DATABASE_URL);
if(!['postgres:','postgresql:'].includes(database.protocol))throw Error('PostgreSQL DATABASE_URL required.');
if(process.env.APP_ENV!=='development'&&database.searchParams.get('sslmode')!=='verify-full')throw Error('DATABASE_URL must verify TLS outside development.');
if(process.env.APP_ENV!=='development')for(const key of ['WASABI_ENDPOINT','WASABI_REGION','WASABI_BUCKET','WASABI_ACCESS_KEY_ID','WASABI_SECRET_ACCESS_KEY','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','MAIL_FROM'])if(!process.env[key])throw Error(`Missing ${key}`);
if(process.env.APP_ENV!=='development'){
 const endpoint=new URL(process.env.WASABI_ENDPOINT);
 if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.wasabisys.com')||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw Error('Use a verified HTTPS Wasabi endpoint.');
 if(!/^\d+$/.test(process.env.SMTP_PORT)||Number(process.env.SMTP_PORT)<1||Number(process.env.SMTP_PORT)>65535)throw Error('Invalid SMTP_PORT.');
}
if(!['direct','cloudflare'].includes(process.env.PROXY_MODE||'direct'))throw Error('Invalid PROXY_MODE.');
if(process.env.PROXY_MODE==='cloudflare'&&(!process.env.EDGE_SHARED_SECRET||process.env.EDGE_SHARED_SECRET.length<32))throw Error('Cloudflare edge secret required.');
process.env.VINEXT_TRUST_PROXY='1';
process.env.VINEXT_TRUSTED_HOSTS=origin.host;
const {startProdServer}=await import('vinext/server/prod-server');
const {server}=await startProdServer({port:Number(process.env.PORT||3000),host:process.env.HOST||'0.0.0.0',outDir:join(import.meta.dirname,'dist')});
const handlers=server.listeners('request');server.removeAllListeners('request');
let draining=false;
const safeSecret=(provided,expected)=>typeof provided==='string'&&Buffer.byteLength(provided)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected));
server.on('request',(req,res)=>{
 const started=performance.now(),requestId=randomUUID(),pathname=(req.url||'/').split('?')[0];
 res.setHeader('X-Request-ID',requestId);res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(origin.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');
 const embeddable=/^\/(book|reservation|widgets|gallery|inquiry|schedule)(?:\/|$)/.test(pathname);
 res.setHeader('Content-Security-Policy',`default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors ${embeddable?'https:':"'self'"}; form-action 'self'`);
 res.once('finish',()=>console.log(JSON.stringify({time:new Date().toISOString(),level:'info',event:'http.request',requestId,method:req.method,path:pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/ig,':id'),status:res.statusCode,durationMs:Math.round(performance.now()-started)})));
 const reject=(status,message)=>{res.statusCode=status;res.end(message);};
 if(draining)return reject(503,'Restarting');
 const health=['/api/health/live','/api/health/ready'].includes(pathname)&&['GET','HEAD'].includes(req.method||'');
 let ip=req.socket.remoteAddress||'unknown';
 if(process.env.PROXY_MODE==='cloudflare'&&!health){
  if(!safeSecret(req.headers['x-eventdesk-edge-secret'],process.env.EDGE_SHARED_SECRET||''))return reject(403,'Forbidden');
  const forwarded=req.headers['cf-connecting-ip'];if(typeof forwarded==='string'&&isIP(forwarded))ip=forwarded;else return reject(400,'Invalid client address');
 }
 for(const key of Object.keys(req.headers))if(key.startsWith('oai-')||key.startsWith('x-forwarded-')||key.startsWith('x-eventdesk-')||key==='cf-connecting-ip')delete req.headers[key];
 req.headers['x-eventdesk-client-ip']=ip;req.headers['x-eventdesk-request-id']=requestId;
 req.headers.host=origin.host;req.headers['x-forwarded-host']=origin.host;req.headers['x-forwarded-proto']=origin.protocol.slice(0,-1);
 // Only public hashed JS/CSS are compressed. Authenticated API bodies stay private.
 if(['GET','HEAD'].includes(req.method||'')&&pathname.startsWith('/_next/static/')&&!req.headers.range){
  let relative;try{relative=decodeURIComponent(pathname.slice('/_next/static/'.length));}catch{return reject(400,'Invalid asset path');}
  if(!/^[a-zA-Z0-9._/-]+$/.test(relative)||relative.split('/').includes('..'))return reject(404,'Not found');
  if(/\.(js|css)$/.test(relative)){
   const accepted=String(req.headers['accept-encoding']||'').split(',').map(v=>v.trim()).filter(v=>! /;\s*q=0(?:\.0*)?$/.test(v)).map(v=>v.split(';')[0]);
   const encoding=accepted.includes('br')?'br':accepted.includes('gzip')?'gzip':'';
   const file=join(import.meta.dirname,'dist/client/_next/static',relative)+(encoding==='br'?'.br':encoding==='gzip'?'.gz':'');
   if(encoding&&existsSync(file)){
    res.setHeader('Content-Type',relative.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    res.setHeader('Content-Encoding',encoding);res.setHeader('Vary','Accept-Encoding');
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('Content-Length',statSync(file).size);
    if(req.method==='HEAD')return res.end();
    const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);return;
   }
  }
 }
 const modifying=!['GET','HEAD','OPTIONS'].includes(req.method||'GET');
 if(modifying&&(req.headers.origin!==origin.origin||req.headers['sec-fetch-site']==='cross-site'))return reject(403,'Invalid request origin');
 const max=/^\/api\/(media|question-file|package-images|catalog-image|logo|event-attachments|sales\/files)/.test(pathname)?10*1024*1024:64*1024;
 if(Number(req.headers['content-length']||0)>max)return reject(413,'Request too large');
 // Count at the stream producer; a data listener would consume bytes before
 // the framework attaches its body reader during asynchronous route loading.
 let size=0;const push=req.push;
 req.push=function(chunk,encoding){if(chunk){size+=Buffer.byteLength(chunk);if(size>max){if(!res.headersSent)reject(413,'Request too large');req.destroy();return false;}}return push.call(this,chunk,encoding);};
 for(const handler of handlers)handler.call(server,req,res);
});
server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
 draining=true;console.log(JSON.stringify({level:'info',event:'server.draining'}));
 server.close(()=>process.exit(0));server.closeIdleConnections();
 setTimeout(()=>{server.closeAllConnections();process.exit(1);},25000).unref();
});
