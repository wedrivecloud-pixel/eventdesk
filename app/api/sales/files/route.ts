import {files} from '@/server/storage';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {businessFor} from '@/db/store';
import {rawDb} from '@/db/raw';
const result=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function list(bid:unknown,record:string){return (await rawDb().prepare("SELECT id,data FROM sales_records WHERE business_id=? AND kind='attachment' AND ed_text(data,'$.recordId')=? ORDER BY created_at").bind(bid,record).all<{id:string;data:string}>()).results.map(r=>({id:r.id,...JSON.parse(r.data)}));}
export async function GET(req:Request){const user=await getChatGPTUser(),b=user?await businessFor(user.userId):null;if(!b)return new Response('Not found',{status:404});const q=new URL(req.url).searchParams,id=q.get('id');if(!id)return result({files:await list(b.id,q.get('record')||'')});const r=await rawDb().prepare("SELECT data FROM sales_records WHERE id=? AND business_id=? AND kind='attachment'").bind(id,b.id).first<{data:string}>();if(!r)return new Response('Not found',{status:404});const file=await files.get(`${b.id}/sales/${id}`);if(!file)return new Response('Not found',{status:404});const d=JSON.parse(r.data);return new Response(file.body,{headers:{'Content-Type':d.contentType,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function PUT(req:Request){try{
 const user=await getChatGPTUser(),b=user?await businessFor(user.userId):null;if(!b)return result({error:'Sign in first.'},401);
 if(req.headers.get('sec-fetch-site')==='cross-site'||(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin))return result({error:'Invalid origin.'},403);
 const q=new URL(req.url).searchParams,record=q.get('record')||'',db=rawDb();if(!await db.prepare("SELECT id FROM resources WHERE id=? AND business_id=? AND kind='expenses' AND archived=0").bind(record,b.id).first())return result({error:'Expense unavailable.'},404);
 if(!req.body)return result({error:'Choose a file.'},400);const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024){await reader.cancel();return result({error:'Files must be under 5 MB.'},413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 const mime=req.headers.get('content-type'),valid=(mime==='application/pdf'&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')||(mime==='image/png'&&size>24&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))||(mime==='image/jpeg'&&size>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255);
 if(!valid)return result({error:'Choose a PDF, PNG or JPEG file.'},400);
 const filename=(q.get('name')||'Receipt').replace(/[\r\n\x00-\x1f]/g,'').slice(0,200),id=crypto.randomUUID(),key=`${b.id}/sales/${id}`,now=new Date().toISOString();
 await files.put(key,bytes,{httpMetadata:{contentType:mime!}});
 try{const saved=await db.prepare("INSERT INTO sales_records(id,business_id,kind,data,created_at,updated_at) SELECT ?,?,'attachment',?,?,? WHERE (SELECT COUNT(*) FROM sales_records WHERE business_id=? AND kind='attachment' AND ed_text(data,'$.recordId')=?)<20").bind(id,b.id,JSON.stringify({recordId:record,filename,contentType:mime,size}),now,now,b.id,record).run();if(!saved.meta.changes)throw Error('Each expense supports up to 20 attachments.');}catch(e){await files.delete(key);throw e;}
 return result({files:await list(b.id,record)});
 }catch{return result({error:'Unable to upload this file. Check the file and try again.'},400);}}
