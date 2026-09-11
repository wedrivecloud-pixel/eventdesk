import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPool,closeDatabase } from '../../db/pool';
import { rawDb } from '../../db/raw';
import { capacityConflictSql } from '../../db/availability';
const enabled=process.env.SEED_SYNTHETIC_DATA==='true';
test('restricted Postgres login, tenant foreign keys, rollback and concurrent capacity',{skip:!enabled},async()=>{
 const pool=getPool(),db=rawDb();const ids=[randomUUID(),randomUUID()];
 try{
  const role=(await pool.query('SELECT rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.deepEqual(role,{rolcreaterole:false,rolcreatedb:false,rolbypassrls:false});
  await assert.rejects(pool.query('CREATE TABLE must_not_create(id text)'),(e:any)=>e.code==='42501');
  const sql=`INSERT INTO events(id,business_id,title,client,email,date,items,total,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT ${capacityConflictSql}`;
  const now=new Date().toISOString(),day='2031-07-20';
  const writes=await Promise.all(ids.map(id=>db.prepare(sql).bind(id,'qa-business','QA capacity','Synthetic','qa@example.test',day,'[]',10000,'confirmed',now,now,JSON.stringify([day]),'qa-business','',1).run()));
  assert.equal(writes.reduce((sum,w)=>sum+w.meta.changes,0),1);
  const active=(await pool.query('SELECT id FROM events WHERE id=ANY($1)',[ids])).rows[0].id;
  await assert.rejects(db.batch([
   db.prepare('UPDATE events SET title=? WHERE id=?').bind('Must roll back',active),
   db.prepare('INSERT INTO event_operations(event_id,business_id,data) VALUES(?,?,?)').bind(active,'qa-other-business','{}'),
  ]));
  assert.equal((await pool.query('SELECT title FROM events WHERE id=$1',[active])).rows[0].title,'QA capacity');
 }finally{await pool.query('DELETE FROM events WHERE id=ANY($1) AND business_id=$2',[ids,'qa-business']);await closeDatabase();}
});
