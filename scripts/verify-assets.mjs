import fs from 'node:fs';
import path from 'node:path';
const root='dist/standalone/dist/client';
const source=fs.readFileSync('dist/standalone/dist/server/__vite_rsc_assets_manifest.js','utf8');
const assets=[...new Set(source.match(/\/_next\/static\/[^"\s]+/g)||[])];
const missing=assets.filter(asset=>!fs.existsSync(path.join(root,asset.slice(1))));
if(missing.length)throw Error('RSC manifest refers to missing assets:\n'+missing.join('\n'));
console.log(`Verified ${assets.length} client assets referenced by the server manifest.`);
