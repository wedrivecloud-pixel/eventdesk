import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const native = createRequire(import.meta.url), cache = new Map();
const categories = [{ id: 'cat', business_id: 'one', data: '{"ownerKind":"backdrops"}' }, { id: 'foreign', business_id: 'two', data: '{"ownerKind":"backdrops"}' }, { id: 'addon-cat', business_id: 'one', data: '{"ownerKind":"addons"}' }];
const db = { prepare() { let args; return { bind(...v) { args = v; return this; }, async first() { return categories.find((r) => r.id === args[0] && r.business_id === args[1]) || null; } }; } };
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file);
  const module = { exports: {} }; cache.set(file, module.exports);
  const require = (p) => {
    if (!p.startsWith('.') && !p.startsWith('@/')) return native(p);
    const path = p.startsWith('@/') ? resolve(p.slice(2)) : resolve(dirname(file), p);
    if (path === resolve('db/raw')) return { rawDb: () => db };
    return load(path + (existsSync(path + '.ts') ? '.ts' : '.tsx'));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, module, module.exports);
  cache.set(file, module.exports); return module.exports;
}
const { buildReport, blankReportFilter, reportNames } = load('lib/sales-reports.ts');
const { catalogColumns } = load('lib/catalog-reports.ts');
const pkg = (id, name, settings = {}) => ({ id, name, service: 'Photo booths', price: 35000, duration: '4 hr 30 min', description: '', settings });
const data = { business: { services: ['Photo booths'] }, events: [], packages: [
  pkg('a', 'Hourly', { group: 'Premium', extraHours: true, extraRate: 150, depositMode: 'Percentage', depositValue: 25 }),
  pkg('b', 'Daily', { dateMode: 'Date Only', durationUnit: 'Days', includedDays: 2, minDays: 1, maxDays: 3, extraDays: true, dailyRate: 90, status: 'Private', taxable: false, depositMode: 'Flat rate', depositValue: 150 }),
  pkg('c', 'Disabled', { status: 'Disabled' }), pkg('d', 'Default'),
], resources: [
  { id: 'cat', kind: 'categories', name: 'Premium', archived: 0, data: { ownerKind: 'backdrops', price: 75, leadDays: 3 } },
  { id: 'x', kind: 'backdrops', name: 'Gold', archived: 0, data: { categoryId: 'cat', price: 0, inheritPrice: true, inheritLead: true, taxable: true, showGallery: true } },
  { id: 'z', kind: 'backdrops', name: 'Free', archived: 0, data: { categoryId: 'cat', price: 0, inheritPrice: false, taxable: false } },
  { id: 'y', kind: 'backdrops', name: 'Retired', archived: 1, data: { price: 20 } },
  { id: 'u', kind: 'addons', name: '=Flash drive', archived: 0, data: { price: 50, maxQuantity: 5, pricingMethod: 'Multiply by package hours', leadDays: 2 } },
], settings: { depositMode: 'Fixed amount', depositValue: 100 } };
const report = (name, f = {}, source = data) => buildReport(source, name, { ...blankReportFilter, ...f });
const all = (name, f = {}) => report(name, { columns: catalogColumns(name), ...f });
const row = (r, id) => Object.fromEntries(r.headers.map((c, i) => [c, r.rows[r.recordIds.indexOf(id)][i]]));
for (const n of ['Packages', 'Add-ons', 'Backdrops']) assert.ok(reportNames.includes(n));
assert.equal(report('Packages').rows.length, 4);
assert.equal(report('Packages', { catalogStatus: 'Public + Private' }).rows.length, 3);
assert.equal(report('Packages', { catalogStatus: 'Private' }).recordIds[0], 'b');
assert.equal(report('Packages', { service: 'Other' }).rows.length, 0);
assert.deepEqual(report('Packages', { packageGroup: 'Premium' }).recordIds, ['a']);
assert.equal(report('Packages', { packageGroup: '__ungrouped__' }).rows.length, 3);
const hourly = row(all('Packages'), 'a'), daily = row(all('Packages'), 'b');
assert.equal(hourly['Included Hours'], 4.5); assert.equal(hourly['Starting Rate USD'], 350); assert.equal(hourly['Price per Extra Hour USD'], 150); assert.equal(hourly.Deposit, '25%');
assert.equal(daily['Included Hours'], '—'); assert.equal(daily['Included Days'], 2); assert.equal(daily['Price per Extra Day USD'], 90); assert.equal(daily.Taxable, 'No'); assert.equal(daily.Deposit, '$150.00');
assert.equal(row(all('Packages'), 'd').Deposit, 'Business default ($100.00)');
assert.equal(row(all('Packages'), 'd')['Price per Extra Hour USD'], '—');
const gold = row(all('Backdrops'), 'x');
assert.equal(gold['Price USD'], 75); assert.equal(gold['Lead Time (days)'], 3); assert.equal(gold['Displayed in Website Widget'], 'Yes');
assert.equal(row(all('Backdrops'), 'z')['Price USD'], 0, 'Explicit zero does not inherit category price');
assert.equal(report('Backdrops').rows.length, 2); assert.equal(report('Backdrops', { catalogStatus: 'All' }).rows.length, 3);
assert.deepEqual(report('Backdrops', { catalogStatus: 'Archived' }).recordIds, ['y']);
assert.deepEqual(report('Backdrops', { catalogStatus: 'All', categoryId: '__uncategorized__' }).recordIds, ['y']);
assert.equal(report('Backdrops', { categoryId: 'foreign' }).rows.length, 0);
assert.deepEqual(report('Backdrops', { sort: 'Price (high to low)' }).recordIds, ['x', 'z']);
assert.deepEqual(report('Backdrops', { sort: 'Price (low to high)' }).recordIds, ['z', 'x']);
const addon = row(all('Add-ons'), 'u'); assert.equal(addon['Max Quantity'], 5); assert.equal(addon['Unit Multiplier Enabled'], 'Yes');
assert.equal(report('Add-ons').rows.length, 1, 'Backdrops never appear in Add-ons');
assert.equal(report('Packages', { from: '2099-01-01', to: '1900-01-01' }).rows.length, 4, 'Catalog reports are not date based');
const hiddenSearch = report('Backdrops', { columns: ['Name', 'Price USD'], search: 'Premium' });
assert.deepEqual(hiddenSearch.headers, ['Name', 'Price USD']); assert.equal(hiddenSearch.rows.length, 2);
assert.equal(report('Backdrops', {}, { ...data, resources: [] }).rows.length, 0);
assert.ok(report('Packages & Add-ons').rows.length, 'Legacy saved combined reports still work');
const { csvText } = load('lib/sales.ts'); assert.ok(csvText([report('Add-ons').headers, ...report('Add-ons').rows]).includes("'=Flash"));
const { validatedSales } = load('db/sales.ts');
const input = { report: 'Backdrops', name: 'Gold stock', categoryId: 'cat', catalogStatus: 'All', sort: 'Price (high to low)', columns: ['Name', 'Price USD'], search: 'gold' };
const saved = await validatedSales('one', 'saved_report', input);
for (const key of Object.keys(input)) assert.deepEqual(saved[key], input[key]);
for (const patch of [{ categoryId: 'foreign' }, { categoryId: 'addon-cat' }, { columns: ['Unknown'] }, { columns: [] }, { catalogStatus: 'Public' }, { sort: 'Invalid' }]) await assert.rejects(() => validatedSales('one', 'saved_report', { ...input, ...patch }));
const packageFilter = await validatedSales('one', 'saved_report', { report: 'Packages', name: 'Premium packages', service: 'Photo booths', packageGroup: 'Premium', catalogStatus: 'Public + Private' });
assert.equal(packageFilter.service, 'Photo booths'); assert.equal(packageFilter.packageGroup, 'Premium'); assert.equal(packageFilter.catalogStatus, 'Public + Private');
console.log('PASS: separate catalog reports, defaults, hours/days, cents/dollars, fixed/percentage/business deposits, category inheritance and explicit zero, statuses, filters, sorting, columns/search, CSV safety, legacy reports, saved report validation and cross-business category rejection.');
