// Run the existing workflow suite against verified auth and synthetic staging.
// The old cookie is replaced only in test requests; the app never accepts it.
if(process.env.SEED_SYNTHETIC_DATA!=='true')throw Error('Legacy workflow QA requires synthetic data.');
const base=process.env.QA_BASE_URL||'http://localhost:3100',original=globalThis.fetch;
const result=await original(base+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'qa-owner@example.test',password:process.env.SEED_PASSWORD})});
if(!result.ok)throw Error(`QA sign-in failed (${result.status}).`);
const cookie=result.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
globalThis.fetch=async(input,options={})=>{
 const url=String(input);if(url!=='http://localhost:3000'&&url!==base&&!url.startsWith('http://localhost:3000/')&&!url.startsWith(base+'/'))return original(input,options);
 const headers=new Headers(options.headers);
 if(headers.get('cookie')?.includes('__sites_local_auth=1'))headers.set('cookie',cookie);
 if(!headers.has('origin'))headers.set('origin',base);
 return original(url.replace('http://localhost:3000',base),{...options,headers});
};
