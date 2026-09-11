import { getAuth } from '@/server/auth';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const response=await getAuth().handler(request);
 if(response.status===429){
  // Better Auth exposes X-Retry-After. Also send the standard HTTP header.
  const seconds=Number(response.headers.get('x-retry-after'));
  response.headers.set('Retry-After',String(Number.isFinite(seconds)&&seconds>0?Math.ceil(seconds):60));
  response.headers.set('Cache-Control','no-store');
 }
 return response;
}
export const GET=handle;
export const POST=handle;
