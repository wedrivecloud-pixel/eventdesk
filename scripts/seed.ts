import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { getPool, closeDatabase } from '../db/pool';
import fs from 'node:fs/promises';
if(!['development','staging'].includes(process.env.APP_ENV||'')||process.env.SEED_SYNTHETIC_DATA!=='true')throw Error('Synthetic seeds require staging/development and SEED_SYNTHETIC_DATA=true.');
const password=process.env.SEED_PASSWORD;
if(!password||password.length<16)throw Error('Set a private SEED_PASSWORD of at least 16 characters.');
const pool=getPool(),client=await pool.connect(),now=new Date().toISOString();
const ids={owner:'qa-owner',other:'qa-other',business:'qa-business',otherBusiness:'qa-other-business',package:'qa-package',otherPackage:'qa-other-package'};
try {
 await client.query('BEGIN');
 for(const [uid,bid,pid,name] of [[ids.owner,ids.business,ids.package,'QA Events'],[ids.other,ids.otherBusiness,ids.otherPackage,'QA Other Business']]){
  await client.query('INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true) ON CONFLICT(id) DO NOTHING',[uid,name,uid+'@example.test']);
  await client.query('INSERT INTO auth_account(id,account_id,provider_id,user_id,password) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET password=EXCLUDED.password',[uid+'-credential',uid,'credential',uid,await hashPassword(password)]);
  await client.query('INSERT INTO businesses(id,owner_id,name,email,services,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',[bid,uid,name,uid+'@example.test',JSON.stringify(['Photobooths','DJs']),now]);
  await client.query('INSERT INTO packages(id,business_id,name,service,price,duration,description,settings,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING',[pid,bid,'QA Photo Booth','Photobooths',40000,'4 hours','Synthetic QA package, not a customer record.',JSON.stringify({status:'Public',includedMinutes:240}),now]);
 }
 await client.query('COMMIT');
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/seed-ids.json',JSON.stringify(ids,null,2));
 console.log('Seeded two synthetic businesses and verified QA accounts. Passwords were not printed.');
}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await closeDatabase();}
