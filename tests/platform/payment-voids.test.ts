import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { parameters } from '../../db/raw';
import { text } from '../../lib/crm';

test('Postgres payment void migration, tenant scope and immutable correction history', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('migrations/postgres/0000_many_piledriver.sql', 'utf8'));
    await db.exec("INSERT INTO businesses(id,owner_id,name,email,services,created_at) VALUES('b','owner','QA','qa@example.test','[]','2026-09-12'); INSERT INTO events(id,business_id,title,client,email,date,items,total,created_at,updated_at) VALUES('e','b','QA','QA','qa@example.test','2027-01-01','[]',35000,'2026-09-12','2026-09-12'); INSERT INTO payments(id,business_id,event_id,amount,tip,method,date,reference,created_at) VALUES('p','b','e',15000,1000,'Cash','2026-09-12','Receipt','2026-09-12');");
    await db.exec(await readFile('migrations/postgres/0003_payment_voids.sql', 'utf8'));
    const adapter = { prepare(query: string) { let values: unknown[] = []; return {
      bind(...v: unknown[]) { values = v; return this; },
      async run() { const r = await db.query(parameters(query), values); return { meta: { changes: r.affectedRows || 0 } }; },
      async first() { return (await db.query(parameters(query), values)).rows[0] || null; },
    }; } };
    const module = { exports: {} as any };
    const source = ts.transpileModule(await readFile('db/payment-voids.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', source)((name: string) => {
      if (name === './raw') return { rawDb: () => adapter };
      if (name === '@/lib/crm') return { text };
      throw Error('Unexpected dependency ' + name);
    }, module, module.exports);
    const { voidRecordedPayment } = module.exports, actor = { userId: 'owner', displayName: 'QA Owner' };
    assert.equal((await db.query<any>('SELECT voided_at FROM payments')).rows[0].voided_at, '');
    assert.equal(await voidRecordedPayment('foreign', 'e', 'p', 'Duplicate', actor), 'not_found');
    assert.equal(await voidRecordedPayment('b', 'wrong', 'p', 'Duplicate', actor), 'not_found');
    await assert.rejects(() => voidRecordedPayment('b', 'e', 'p', ' ', actor));
    assert.equal(await voidRecordedPayment('b', 'e', 'p', 'Duplicate', actor), 'voided');
    const first = (await db.query<any>('SELECT * FROM payments')).rows[0];
    assert.equal(first.voided_by, 'owner'); assert.equal(first.voided_by_name, 'QA Owner');
    assert.equal(first.amount, 15000); assert.equal(first.tip, 1000); assert.equal(first.reference, 'Receipt');
    assert.equal(await voidRecordedPayment('b', 'e', 'p', 'Overwrite', actor), 'already_voided');
    assert.deepEqual((await db.query('SELECT * FROM payments')).rows[0], first);
    assert.equal((await db.query("SELECT * FROM payments WHERE voided_at=''")).rows.length, 0);
  } finally { await db.close(); }
});
