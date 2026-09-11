import pg from 'pg';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { databaseUrl } from '../server/config';
// Provision through SQL: Neon API-created roles inherit neon_superuser.
// Run once per new environment with its owner connection; never in the app.
const configFile=process.argv[2];
if(!configFile||!/^\.env\.(staging|production)\.local$/.test(configFile))throw Error('Choose an ignored environment file.');
const ownerUrl=databaseUrl('DIRECT_DATABASE_URL'),client=new pg.Client({connectionString:ownerUrl});
await client.connect();
try{
 const existing=await client.query("SELECT 1 FROM pg_roles WHERE rolname='eventdesk_runtime'");
 if(existing.rowCount)throw Error('Runtime role already exists; do not rotate credentials implicitly.');
 const password=randomBytes(40).toString('hex');
 await client.query(`CREATE ROLE eventdesk_runtime LOGIN PASSWORD '${password}' NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
 await client.query('GRANT CONNECT ON DATABASE eventdesk TO eventdesk_runtime');
 await client.query('GRANT USAGE ON SCHEMA public TO eventdesk_runtime');
 await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON businesses,packages,events,business_settings,resources,event_operations,payments,package_images,booking_rate_limits,sales_records,auth_user,auth_session,auth_account,auth_verification,auth_rate_limit TO eventdesk_runtime');
 await client.query('GRANT SELECT ON eventdesk_migrations TO eventdesk_runtime');
 const check=await client.query("SELECT rolcreaterole,rolcreatedb,rolbypassrls,EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE m.member=pg_roles.oid) AS member_of_other_role FROM pg_roles WHERE rolname='eventdesk_runtime'");
 if(Object.values(check.rows[0]).some(Boolean))throw Error('Runtime role has administrative privileges.');
 const url=new URL(ownerUrl);url.username='eventdesk_runtime';url.password=password;
 if(url.hostname.endsWith('.neon.tech')) {
  if(url.hostname.startsWith('ep-')&&!url.hostname.split('.')[0].endsWith('-pooler'))url.hostname=url.hostname.replace('.', '-pooler.');
  url.searchParams.set('sslmode','verify-full');
 }
 const source=await fs.readFile(configFile,'utf8');
 await fs.writeFile(configFile,source.replace(/^DATABASE_URL=.*$/m,'DATABASE_URL='+url.toString()));
 console.log('Created a non-admin runtime role and updated the ignored local config.');
}finally{await client.end();}
