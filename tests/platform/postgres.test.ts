import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { parameters } from '../../db/raw';
import { capacityConflictSql } from '../../db/availability';
import { scheduleGuard } from '../../db/schedule-guards';
import { inventoryGuard } from '../../db/manage-guards';
test('Postgres schema, JSON edits, scheduling and capacity guards',async()=>{
 const db=new PGlite();
 try{
  await db.exec(await fs.readFile('migrations/postgres/0000_many_piledriver.sql','utf8'));
  await db.exec(await fs.readFile('migrations/functions.sql','utf8'));
  await db.exec(await fs.readFile('migrations/postgres/0002_preserve_nested_array_objects.sql','utf8'));
  const query=async(sql:string,args:unknown[]=[])=>db.query(parameters(sql),args);
  let r=await query(`SELECT ed_text(?, '$.name') AS name, ed_number(?,'$.enabled') AS enabled`,['{"name":"O\'Brien"}','{"enabled":true}']);
  assert.equal((r.rows[0] as any).name,"O'Brien");assert.equal(Number((r.rows[0] as any).enabled),1);
  r=await query(`SELECT ed_set(?, '$.tasks[0].done', ed_json(?))::jsonb AS value`,['{"tasks":[{"id":"keep-id","label":"Pack camera","done":false},{"id":"second","done":false}]}','true']);
  assert.deepEqual((r.rows[0] as any).value.tasks,[{id:'keep-id',label:'Pack camera',done:true},{id:'second',done:false}]);
  r=await query(`SELECT ed_patch(?,?)::jsonb AS value`,['{"a":{"b":1,"c":2}}','{"a":{"b":null,"d":3}}']);
  assert.deepEqual((r.rows[0] as any).value,{a:{c:2,d:3}});
  await query('INSERT INTO businesses(id,owner_id,name,email,services,created_at) VALUES(?,?,?,?,?,?)',['b','u','QA','qa@example.test','[]','2026-09-10']);
  await query('INSERT INTO events(id,business_id,title,client,email,date,items,total,created_at,updated_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)',['e','b','QA','QA','qa@example.test','2027-01-01','[]',10000,'2026-09-10','2026-09-10','confirmed']);
  r=await query(`SELECT ${capacityConflictSql} AS full`,[JSON.stringify(['2027-01-01']),'b','',1]);assert.equal((r.rows[0] as any).full,true);
  r=await query(`SELECT ${capacityConflictSql} AS full`,[JSON.stringify(['2027-01-02']),'b','',1]);assert.equal((r.rows[0] as any).full,false);
  const w={start:Date.parse('2027-01-01T12:00:00Z'),end:Date.parse('2027-01-01T16:00:00Z')};
  const guard=scheduleGuard('b','',w,['owner'],{bookings:'all'});
  r=await query(`SELECT ${guard.sql} AS full`,guard.args);assert.equal((r.rows[0] as any).full,true);
  const inventory=inventoryGuard('b','',{date:'2027-01-01',time:'12:00',items:[]},[]);
  r=await query(`SELECT ${inventory.sql} AS full`,inventory.args);assert.equal((r.rows[0] as any).full,false);
 }finally{await db.close();}
});
test('prepared parameters preserve literals and never interpolate user data',()=>{
 assert.equal(parameters("SELECT '?' AS mark, 'it''s ?' AS text WHERE id=?"),"SELECT '?' AS mark, 'it''s ?' AS text WHERE id=$1");
});
