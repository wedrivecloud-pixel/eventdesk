import assert from 'node:assert/strict';
import { getPool,closeDatabase } from '../db/pool';
const db=getPool();
try{
 const role=(await db.query('SELECT rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.deepEqual(role,{rolcreaterole:false,rolcreatedb:false,rolbypassrls:false});
 const migrations=(await db.query('SELECT name FROM eventdesk_migrations ORDER BY name')).rows.map(r=>r.name);assert.equal(migrations.length,4);
 const patched=(await db.query("SELECT ed_set('{\"tasks\":[{\"id\":\"keep\",\"done\":false}]}','$.tasks[0].done',ed_json('true'))::jsonb AS value")).rows[0].value;
 assert.deepEqual(patched,{tasks:[{id:'keep',done:true}]});
 if(process.argv.includes('--production-empty')){
  assert.equal(process.env.APP_ENV,'production');
  for(const table of ['businesses','events','resources','packages','payments','auth_user'])assert.equal(Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n),0,`${table} must start empty`);
 }
 console.log(JSON.stringify({environment:process.env.APP_ENV,restrictedRuntime:true,migrations:migrations.length,nestedJsonVerified:true,emptyProductionVerified:process.argv.includes('--production-empty')}));
}finally{await closeDatabase();}
