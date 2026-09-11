import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { databaseUrl } from '../server/config';
// Direct connection for DDL, separate from the pooled application connection.
const client=new pg.Client({connectionString:databaseUrl('DIRECT_DATABASE_URL'),application_name:'eventdesk-migrate'});
await client.connect();
try {
 await client.query("SELECT pg_advisory_lock(hashtext('eventdesk:migrations'))");
 await client.query('CREATE TABLE IF NOT EXISTS eventdesk_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
 const folder='migrations/postgres';
 const files=['../functions.sql',...(await fs.readdir(folder)).filter(f=>f.endsWith('.sql')).sort()];
 for(const name of files){
  const sql=await fs.readFile(path.join(folder,name),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
  const prior=await client.query('SELECT checksum FROM eventdesk_migrations WHERE name=$1',[name]);
  if(prior.rows.length){if(prior.rows[0].checksum!==checksum)throw Error(`Applied migration changed: ${name}. Create a new version instead.`);continue;}
  await client.query('BEGIN');
  try{await client.query(sql);await client.query('INSERT INTO eventdesk_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);await client.query('COMMIT');console.log('Applied migration:',name);}
  catch(e){await client.query('ROLLBACK');throw e;}
 }
}finally{await client.query("SELECT pg_advisory_unlock(hashtext('eventdesk:migrations'))").catch(()=>{});await client.end();}
