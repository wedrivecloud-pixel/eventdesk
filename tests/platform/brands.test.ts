import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { parameters } from '../../db/raw';
import { text, email } from '../../lib/crm';
import { mergedSettings, type Resource } from '../../lib/settings';
import { brandRecords, findBrand, brandHasPackage, checkedBrandSocials, brandSocialLinks } from '../../lib/brands';
import { checkedBrandPresentation } from '../../db/brand-presentation';
import { presentationFromSettings } from '../../lib/brand-presentation';

await test('Postgres brands preserve package arrays and tenant-scoped lifecycle', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      await readFile('migrations/postgres/0000_many_piledriver.sql', 'utf8'),
    );
    await pg.exec(
      "INSERT INTO businesses(id,owner_id,name,email,services,created_at) VALUES('a','owner-a','QA','qa@example.test','[]','2026-09-12'),('b','owner-b','Other','other@example.test','[]','2026-09-12'); INSERT INTO packages(id,business_id,name,service,price,duration,description,created_at) VALUES('p','a','Package','Photobooths',40000,'4 hours','','2026-09-12'); INSERT INTO resources(id,business_id,kind,name,data,created_at,updated_at) VALUES('logo','a','media','Logo','{\"mime\":\"image/png\"}','2026-09-12','2026-09-12');",
    );
    const adapter = {
      async batch(items: Array<{ run: () => Promise<unknown> }>) {
        await pg.exec('BEGIN');
        try { const values = []; for (const item of items) values.push(await item.run()); await pg.exec('COMMIT'); return values; }
        catch (err) { await pg.exec('ROLLBACK'); throw err; }
      },
      prepare(query: string) {
        let values: unknown[] = [];
        return {
          bind(...v: unknown[]) {
            values = v;
            return this;
          },
          async first() {
            return (await pg.query(parameters(query), values)).rows[0] || null;
          },
          async all() {
            return {
              results: (await pg.query(parameters(query), values)).rows,
            };
          },
          async run() {
            return {
              meta: {
                changes:
                  (await pg.query(parameters(query), values)).affectedRows || 0,
              },
            };
          },
        };
      },
    };
    async function configuration(bid: unknown) {
      const rows = (
        await adapter
          .prepare('SELECT * FROM resources WHERE business_id=?')
          .bind(bid)
          .all()
      ).results as Array<Omit<Resource, 'data'> & { data: string }>;
      return {
        resources: rows.map((r) => ({ ...r, data: JSON.parse(r.data) })),
        settings: mergedSettings(JSON.parse(String(((await adapter.prepare('SELECT data FROM business_settings WHERE business_id=?').bind(bid).first()) as { data?: string } | null)?.data || '{}'))),
      };
    }
    // Compile the real persistence helper with this isolated database adapter.
    /* oxlint-disable next/no-assign-module-variable, typescript/no-implied-eval */
    const module = {
      exports: {} as {
        brandAction: typeof import('../../db/brands').brandAction;
      },
    };
    new Function(
      'require',
      'module',
      'exports',
      ts.transpileModule(await readFile('db/brands.ts', 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    )(
      (path: string) => {
        if (path === './raw') return { rawDb: () => adapter };
        if (path === './store') return { configuration };
        if (path === '@/lib/crm') return { text, email };
        if (path === './brand-presentation') return { checkedBrandPresentation };
        if (path === '@/lib/brand-presentation') return { presentationFromSettings };
        if (path === '@/lib/brands') return { brandRecords, checkedBrandSocials };
        throw Error(path);
      },
      module,
      module.exports,
    );
    const { brandAction } = module.exports,
      body = {
        action: 'save_brand',
        name: 'Second brand',
        data: {
          email: 'second@example.test',
          logoId: 'logo',
          color: '#128899',
          packageMode: 'selected',
          packageIds: ['p'],
          instagramUrl: 'https://www.instagram.com/examplebrand',
          about: 'Our event team.',
          trustIndicators: [{ type: 'Events Hosted', value: '100+' }],
        },
      };
    assert.equal(await brandAction('a', body), true);
    let config = await configuration('a');
    const row = brandRecords(config.resources)[0],
      id = row.id;
    assert.deepEqual(findBrand(config.resources, id)?.packageIds, ['p']);
    assert.deepEqual(findBrand(config.resources, id)?.trustIndicators, body.data.trustIndicators);
    assert.deepEqual(brandSocialLinks(findBrand(config.resources, id)), [{ label: 'Instagram', url: body.data.instagramUrl }]);
    await assert.rejects(() => brandAction('a', { ...body, id, data: { ...body.data, instagramUrl: 'javascript:alert(1)' } }), /Instagram/);
    await brandAction('a', { ...body, id, data: { ...body.data, instagramUrl: '' } });
    assert.deepEqual(brandSocialLinks(findBrand((await configuration('a')).resources, id)), []);
    assert.equal(brandHasPackage(findBrand(config.resources, id), 'p'), true);
    assert.equal(
      brandHasPackage(findBrand(config.resources, id), 'other'),
      false,
    );
    await assert.rejects(() => brandAction('b', { ...body, id }), /NOT_FOUND/);
    await assert.rejects(
      () => brandAction('b', { action: 'archive_brand', id }),
      /NOT_FOUND/,
    );
    await assert.rejects(() => brandAction('b', body), /media library/);
    await assert.rejects(
      () =>
        brandAction('a', {
          ...body,
          id,
          data: { ...body.data, packageIds: ['foreign'] },
        }),
      /your business/,
    );
    await brandAction('a', { action: 'archive_brand', id });
    config = await configuration('a');
    assert.throws(() => findBrand(config.resources, id), /unavailable/);
    await brandAction('a', { action: 'restore_brand', id });
    await brandAction('a', {
      ...body,
      id,
      data: { ...body.data, packageMode: 'all', packageIds: [] },
    });
    config = await configuration('a');
    assert.equal(
      brandHasPackage(findBrand(config.resources, id), 'future-package'),
      true,
    );
    assert.equal((await configuration('b')).resources.length, 0);
    await brandAction('a', { action: 'save_primary_brand_details', data: { ...body.data, name: 'Primary updated', email: 'primary@example.test', overrideInvoice: true, invoiceLogoId: 'logo', showAddress: false } });
    const primary = await configuration('a');
    assert.deepEqual(presentationFromSettings(primary.settings).trustIndicators, body.data.trustIndicators);
    assert.equal(primary.settings.showAddress, false);
    assert.equal(primary.settings.invoiceLogoId, 'logo');
    assert.equal((await pg.query<{name:string}>("SELECT name FROM businesses WHERE id='a'")).rows[0].name, 'Primary updated');
    assert.equal((await pg.query<{name:string}>("SELECT name FROM businesses WHERE id='b'")).rows[0].name, 'Other');
  } finally {
    await pg.close();
  }
});
