import type { PoolClient, QueryResultRow } from 'pg';
import { getPool } from './pool';
import { log } from '../server/logger';

// PostgreSQL SQL throughout. Only parameter markers are compiled here, never values.
export function parameters(sql: string) {
  let output = '', quoted = false, index = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      output += c;
      if (quoted && sql[i + 1] === "'") { output += sql[++i]; continue; }
      quoted = !quoted;
    } else output += c === '?' && !quoted ? `$${++index}` : c;
  }
  if (quoted) throw new Error('Unclosed SQL string.');
  return output;
}
export class PreparedStatement {
  constructor(readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new PreparedStatement(this.sql, values); }
  async execute(client: PoolClient) {
    const result = await client.query(parameters(this.sql), this.values);
    return { results: result.rows, meta: { changes: result.command === 'SELECT' ? 0 : (result.rowCount || 0) }, success: true };
  }
  async all<T = Record<string, unknown>>() { return (await transaction([this]))[0] as {results: T[]; meta: {changes:number}; success:boolean}; }
  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const { results } = await this.all<QueryResultRow>();
    return ((column ? results[0]?.[column] : results[0]) as T) ?? null;
  }
  async run() { return (await transaction([this]))[0]; }
}
async function transaction(statements: PreparedStatement[]) {
  for (let attempt = 0; ; attempt++) {
    let client: PoolClient;
    try { client = await getPool().connect(); }
    catch (error) {
      log('error', 'database.connection_failed', {code: String((error as {code?:string}).code || 'unknown')});
      throw new Error('Database unavailable.', { cause: error });
    }
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const results = [];
      for (const statement of statements) results.push(await statement.execute(client));
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      const code = String((error as {code?:string}).code || 'unknown');
      if (['40001', '40P01'].includes(code) && attempt < 4) {
        log('warn', 'database.retry', { code, attempt: attempt + 1 });
      } else {
        log('error', 'database.query_failed', { code });
        throw new Error('Database unavailable.', { cause: error });
      }
    } finally { client.release(); }
    await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1) + Math.random() * 30));
  }
}
const db = { prepare: (sql: string) => new PreparedStatement(sql), batch: transaction };
export function rawDb() { return db; }
