import fs from 'node:fs/promises';
import pg from 'pg';
import { databaseUrl } from '../server/config';
// Inputs are private JSON files: {tableName:[rows]} and {oldOwnerId:newVerifiedUserId}.
// Never execute raw SQLite SQL on Postgres or infer ownership from email alone.
if(process.env.LEGACY_IMPORT_ENABLED!=='true')throw Error('Review the export and owner mapping before enabling import.');
const [exportPath,mappingPath]=process.argv.slice(2);if(!exportPath||!mappingPath)throw Error('Provide export JSON and reviewed owner-map JSON.');
const data=JSON.parse(await fs.readFile(exportPath,'utf8')),mapping=JSON.parse(await fs.readFile(mappingPath,'utf8'));
const tables=['businesses','business_settings','packages','events','resources','event_operations','payments','package_images','sales_records'];
const jsonColumns=new Set(['services','settings','items','data']);
const client=new pg.Client({connectionString:databaseUrl('DIRECT_DATABASE_URL')});await client.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 const report:Record<string,unknown>={};
 for(const table of tables){
  if(!Array.isArray(data[table]))throw Error(`Missing export table: ${table}`);
  const count=await client.query(`SELECT count(*) FROM ${table}`);if(Number(count.rows[0].count)!==0)throw Error(`Import target is not empty: ${table}`);
  const columns=(await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['public',table])).rows.map(r=>r.column_name);
  for(const original of data[table]){
   const row={...original};
   if(table==='businesses'){
    const mapped=mapping[row.owner_id];if(typeof mapped!=='string')throw Error(`Owner mapping missing for business ${row.id}`);
    const verified=await client.query('SELECT id FROM auth_user WHERE id=$1 AND email_verified=true',[mapped]);if(!verified.rowCount)throw Error('Mapped owner must have a verified account.');
    row.owner_id=mapped;
   }
   const names=Object.keys(row);if(names.some(name=>!columns.includes(name)))throw Error(`Unexpected columns in ${table}`);
   for(const name of names){if(jsonColumns.has(name))JSON.parse(row[name]);if(['total','deposit','price','amount','tip'].includes(name)&&!Number.isSafeInteger(row[name]))throw Error(`Invalid money in ${table}.${name}`);}
   await client.query(`INSERT INTO ${table}(${names.map(n=>'"'+n+'"').join(',')}) VALUES(${names.map((_,i)=>'$'+(i+1)).join(',')})`,names.map(n=>row[n]));
  }
  const inserted=Number((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
  if(inserted!==data[table].length)throw Error(`Count mismatch: ${table}`);
  report[table]={sourceRows:data[table].length,targetRows:inserted};
 }
 const sourceTotal=data.events.reduce((n:number,e:any)=>n+e.total,0),targetTotal=Number((await client.query('SELECT coalesce(sum(total),0) AS total FROM events')).rows[0].total);
 const sourcePaid=data.payments.reduce((n:number,p:any)=>n+p.amount,0),targetPaid=Number((await client.query('SELECT coalesce(sum(amount),0) AS total FROM payments')).rows[0].total);
 if(sourceTotal!==targetTotal||sourcePaid!==targetPaid)throw Error('Financial reconciliation failed.');
 await client.query('COMMIT');
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/legacy-import.json',JSON.stringify({tables:report,eventTotal:targetTotal,payments:targetPaid,verifiedAt:new Date().toISOString()},null,2));
 console.log('Imported and reconciled application records. Source data was retained.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
