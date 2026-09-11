import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
test('all server routes and rendered pages use the PostgreSQL/storage adapters',async()=>{
 for(const root of ['app','db','server']) {
  for(const file of (await fs.readdir(root,{recursive:true})).filter(f=>/\.(ts|tsx|mjs)$/.test(f))) {
   const source=await fs.readFile(path.join(root,file),'utf8');
   assert.doesNotMatch(source,/\b(?:json_extract|json_each|json_set|json_patch|julianday)\s*\(|cloudflare:workers|__sites_local_auth/,`${root}/${file} retains a legacy runtime dependency`);
  }
 }
});
