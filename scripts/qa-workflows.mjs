import { spawn,spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
const names=process.argv.slice(2);
if(!names.length)throw Error('Specify workflow test names.');
await fs.mkdir('artifacts',{recursive:true});const report=[];
for(const name of names){
 if(!/^[a-z-]+$/.test(name))throw Error('Invalid test name.');
 const started=Date.now();let output='';
 const source=await fs.readFile(`tests/${name}.mjs`,'utf8');
 const usesApi=source.includes('localhost:3000')||source.includes('QA_BASE_URL');
 if(usesApi){const reset=spawnSync(process.execPath,['--import','tsx','scripts/reset-qa-limits.ts'],{env:process.env,encoding:'utf8'});if(reset.status!==0)throw Error('Synthetic rate-limit reset failed: '+reset.stderr);}
 const code=await new Promise(resolve=>{
  const p=spawn(process.execPath,['--import','tsx',...(usesApi?['--import','./tests/platform/legacy-bridge.mjs']:[]),`tests/${name}.mjs`],{env:process.env,stdio:['ignore','pipe','pipe']});
  p.stdout.on('data',d=>{output+=d;});p.stderr.on('data',d=>{output+=d;});p.on('exit',resolve);p.on('error',e=>{output+=e.message;resolve(1);});
 });
 await fs.writeFile(`artifacts/qa-${name}.log`,output);
 report.push({name,code,durationMs:Date.now()-started});console.log(JSON.stringify(report.at(-1)));
 await fs.appendFile('artifacts/workflow-history.ndjson',JSON.stringify({...report.at(-1),testedAt:new Date().toISOString()})+'\n');
 await fs.writeFile('artifacts/workflows.json',JSON.stringify(report,null,2));
}
process.exitCode=report.some(x=>x.code!==0)?1:0;
