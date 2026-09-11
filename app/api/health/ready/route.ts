import { getPool } from '@/db/pool';
import { files } from '@/server/storage';
import release from '@/server/release.json';
export const dynamic='force-dynamic';
export async function GET(){
 try {
  const required=['../functions.sql','0000_many_piledriver.sql','0001_tenant_constraints.sql','0002_preserve_nested_array_objects.sql'];
  const result=await getPool().query('SELECT count(*)::integer AS count FROM eventdesk_migrations WHERE name=ANY($1)',[required]);
  if(result.rows[0].count!==required.length)throw Error('Schema incomplete.');
  await files.health();
  return Response.json({status:'ready',commit:release.commit},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({status:'not_ready'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
