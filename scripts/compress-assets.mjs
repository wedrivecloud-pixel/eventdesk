import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress,gzip,constants } from 'node:zlib';
const br=promisify(brotliCompress),gz=promisify(gzip),root='dist/standalone/dist/client/_next/static';
let raw=0,compressed=0,count=0;
for(const file of (await fs.readdir(root,{recursive:true})).filter(f=>/\.(js|css)$/.test(f))){
 const name=path.join(root,file),bytes=await fs.readFile(name);
 const [brotli,gzipped]=await Promise.all([br(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:9}}),gz(bytes,{level:9})]);
 await fs.writeFile(name+'.br',brotli);await fs.writeFile(name+'.gz',gzipped);
 raw+=bytes.length;compressed+=brotli.length;count++;
}
console.log(`Precompressed ${count} static assets: ${raw} bytes → ${compressed} bytes (Brotli).`);
