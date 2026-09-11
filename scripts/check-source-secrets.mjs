import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
// A focused local/CI guard, not a substitute for provider secret scanning.
// Report file names only; never print a matched credential.
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const values=[];
for(const file of ['.env.staging.local','.env.production.local']){
 try{
  const env=parseEnv(await fs.readFile(file,'utf8'));
  for(const [key,value] of Object.entries(env))if(/PASSWORD|SECRET|DATABASE_URL|ACCESS_KEY/.test(key)&&value.length>=20)values.push(value);
 }catch(error){if(error.code!=='ENOENT')throw error;}
}
const failures=[];
for(const file of files){
 if(/(^|\/)\.env(?:\.|$)/.test(file)&&file!=='.env.example'){failures.push(file);continue;}
 if(!/\.(ts|tsx|js|mjs|json|md|ya?ml|example)$/.test(file))continue;
 let text;try{text=await fs.readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
 if(values.some(value=>text.includes(value))||/postgres(?:ql)?:\/\/[^\s"']+@[^\s"']*\.neon\.tech/.test(text)||/\bgh[pousr]_[a-zA-Z0-9]{36,}\b/.test(text))failures.push(file);
}
if(failures.length){console.error('Potential committed credentials in files:',[...new Set(failures)].join(', '));process.exitCode=1;}
else console.log('Source credential guard passed; ignored local credentials are excluded.');
