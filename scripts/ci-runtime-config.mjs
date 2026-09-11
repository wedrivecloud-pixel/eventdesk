import fs from 'node:fs/promises';
if(process.env.CI!=='true'||process.env.APP_ENV!=='development')throw Error('CI-only setup.');
const file='.env.staging.local';
if(process.argv[2]==='init')await fs.writeFile(file,`DATABASE_URL=${process.env.DATABASE_URL}\n`);
else {
 const source=await fs.readFile(file,'utf8'),value=source.match(/^DATABASE_URL=(.+)$/m)?.[1];
 if(!value||!process.env.GITHUB_ENV)throw Error('Missing generated runtime config.');
 console.log(`::add-mask::${value}`);
 await fs.appendFile(process.env.GITHUB_ENV,`DATABASE_URL=${value}\n`);
}
