import pg from 'pg';
import { databaseUrl } from '../server/config';
import { log } from '../server/logger';
let pool: pg.Pool | undefined;
export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl(), max: 10,
      connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
      statement_timeout: 15000, application_name: `eventdesk-${process.env.APP_ENV || 'development'}`,
    });
    pool.on('error', () => log('error', 'database.pool_error'));
  }
  return pool;
}
export async function closeDatabase() { await pool?.end(); pool = undefined; }
