import fs from 'node:fs/promises';
const commit=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Provide the exact tested Git commit SHA.');
await fs.writeFile('server/release.json',JSON.stringify({commit})+'\n');
console.log('Stamped the build with its tested Git commit.');
