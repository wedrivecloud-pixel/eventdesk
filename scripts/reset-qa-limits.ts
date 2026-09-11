import { getPool,closeDatabase } from '../db/pool';
// Test fixture teardown, never an application bypass. The next test still runs
// against the real configured limits and can verify that they reject excess use.
if(!['development','staging'].includes(process.env.APP_ENV||'')||process.env.SEED_SYNTHETIC_DATA!=='true')throw Error('Synthetic QA database required.');
const db=getPool();
try{
 const rows=(await db.query('SELECT id,owner_id FROM businesses ORDER BY id')).rows;
 if(rows.length!==2||rows.some(r=>!['qa-business','qa-other-business'].includes(r.id)||!['qa-owner','qa-other'].includes(r.owner_id)))throw Error('Refusing to reset limits outside the two-business synthetic fixture.');
 await db.query('DELETE FROM booking_rate_limits');await db.query('DELETE FROM auth_rate_limit');
 console.log('Reset rate-limit fixtures for the next isolated QA scenario.');
}finally{await closeDatabase();}
