import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function verifyRelease({url,sha,attempts=30,delayMs=10000}){
 if(!/^[0-9a-f]{40}$/.test(sha||''))throw Error('Expected release SHA is required.');
 const endpoint=new URL('/api/health/ready',url);
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const response=await fetch(endpoint,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
   const body=await response.json();
   if(response.ok&&body.status==='ready'&&body.commit===sha){console.log('Verified readiness for the deployed commit.');return;}
  }catch{}
  if(attempt+1<attempts)await new Promise(resolve=>setTimeout(resolve,delayMs));
 }
 throw Error('The expected release did not become ready. An older healthy deployment is not success.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyRelease({url:process.env.APP_URL,sha:process.env.RELEASE_SHA});
