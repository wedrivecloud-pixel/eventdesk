import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getPool } from './db/pool';
let nextPrune=0;
export async function middleware(request:NextRequest) {
 if(request.nextUrl.pathname.startsWith('/api/health/'))return NextResponse.next();
 const ip=request.headers.get('x-eventdesk-client-ip')||'unknown';
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/60);
 const read=['GET','HEAD'].includes(request.method),limit=read?600:200;
 const key=createHash('sha256').update(`api:${ip}:${read}:${window}`).digest('hex');
 try {
  if(now>=nextPrune){
   nextPrune=now+60;
   await getPool().query('DELETE FROM booking_rate_limits WHERE key IN (SELECT key FROM booking_rate_limits WHERE expires_at<$1 ORDER BY expires_at LIMIT 1000)',[now]);
  }
  const result=await getPool().query('INSERT INTO booking_rate_limits(key,hits,expires_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=booking_rate_limits.hits+1 WHERE booking_rate_limits.hits<$3 RETURNING hits',[key,(window+1)*60,limit]);
  if(!result.rowCount)return NextResponse.json({error:'Too many requests. Try again shortly.'},{status:429,headers:{'Retry-After':String(60-now%60),'Cache-Control':'no-store'}});
  return NextResponse.next();
 }catch{return NextResponse.json({error:'Service temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const config={matcher:['/api/:path*']};
