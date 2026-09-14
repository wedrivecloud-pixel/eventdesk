import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const native = createRequire(import.meta.url), cache = new Map();
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file);
  const module = { exports: {} }; cache.set(file, module.exports);
  const require = (p) => {
    if (!p.startsWith('.') && !p.startsWith('@/')) return native(p);
    const path = p.startsWith('@/') ? resolve(p.slice(2)) : resolve(dirname(file), p);
    if (path === resolve('db/raw')) return { rawDb: () => { throw Error('Unexpected database access'); } };
    return load(path + (existsSync(path + '.ts') ? '.ts' : '.tsx'));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(require, module, module.exports);
  cache.set(file, module.exports); return module.exports;
}
const { buildReport, blankReportFilter } = load('lib/sales-reports.ts');
const { validatedSales } = load('db/sales.ts');
const { csvText } = load('lib/sales.ts');
const item = (id = 'p', settings = {}) => ({ id, name: id, service: 'Booths', duration: '2 hr', minutes: 120, price: 10000, packageSettings: settings });
const event = (id, time, patch = {}) => ({ id, title: id, date: '2030-01-09', time, status: 'confirmed', lifecycle: 'Active', items: [item()], operations: { staffIds: ['s'], quote: { extras: [{ id: 'a', name: 'Lights', kind: 'addons', quantity: 3 }, { id: 'b', name: 'Backdrop', kind: 'backdrops', quantity: 1 }] } }, ...patch });
const resource = (id, kind, data = {}, archived = 0) => ({ id, name: id, kind, data, archived });
const data = { business: { services: ['Booths'] }, settings: { timezone: 'America/Los_Angeles' }, packages: [{ ...item(), settings: { includedAddonIds: ['a'] } }, { ...item('q'), settings: {} }, { ...item('unused'), settings: {} }], resources: [resource('s', 'staff'), resource('unusedStaff', 'staff'), resource('a', 'addons', { maxQuantity: 10 }), resource('b', 'backdrops'), resource('pool', 'inventory_rules', { packageMode: 'selected', packageIds: ['p', 'q'], capacity: 1 })], sales: [], events: [
  event('overnight', '23:00', { date: '2030-01-08' }), event('morning', '09:00', { items: [item('p', { includedAddonIds: ['a'] })] }), event('backToBack', '11:00'),
  event('otherPool', '09:30', { items: [item('q')], operations: {} }),
  event('cancelled', '09:00', { lifecycle: 'Canceled' }), event('proposal', '09:00', { status: 'proposal' }),
] };
const report = (group = 'Packages', f = {}, source = data) => buildReport(source, 'Daily Utilization', { ...blankReportFilter, group, utilizationDate: '2030-01-09', ...f });
let r = report(); let p = r.entries.find((r) => r.id === 'p');
assert.equal(p.reserved, 3); assert.equal(p.peak, 1); assert.equal(p.status, 'Shared pool over limit');
assert.equal(r.entries.find((r) => r.id === 'unused').reserved, 0);
assert.equal(report('Add-ons').entries[0].reserved, 9); assert.equal(report('Add-ons').entries[0].peak, 3); assert.equal(report('Add-ons').entries[0].limit, 'Not configured');
assert.equal(report('Backdrops').entries[0].reserved, 3);
assert.equal(report('Bundles').entries.length, 1); assert.equal(report('Bundles').entries[0].reserved, 1, 'New inclusions must not rewrite old reservations');
assert.equal(report('Staff').entries.find((r) => r.id === 's').reserved, 3);
data.sales = [resource('appt', 'appointment', { staffId: 's', status: 'Confirmed', date: '2030-01-09', time: '10:00', minutes: 30, title: 'Consultation' }), resource('pending', 'appointment', { staffId: 's', status: 'Pending', date: '2030-01-09', time: '10:00', minutes: 30 }), resource('off', 'time_off', { staffId: 's', status: 'Approved', start: '2030-01-09', end: '2030-01-09', allDay: true })];
p = report('Staff').entries.find((r) => r.id === 's'); assert.equal(p.reserved, 4); assert.equal(p.peak, 2); assert.match(p.status, /Approved time off/);
assert.equal(report('Packages', { utilizationDate: '2030-01-08' }).entries.find((r) => r.id === 'p').reserved, 1);
assert.equal(report('Packages', { utilizationDate: '2030-01-10' }).entries.find((r) => r.id === 'p').reserved, 0);
assert.ok(report('Packages', { utilizationDate: '2030-02-30' }).error);
assert.deepEqual(report('Packages', { columns: ['Reserved', 'Name'], search: 'unused' }).rows, [['unused', 0]]);
assert.equal(report('Packages', { sort: 'Reserved (highest first)' }).entries[0].id, 'p');
const allDay = { ...data, events: [event('multi', '', { date: '2030-01-08', items: [{ ...item(), minutes: 2880, packageSettings: { dateMode: 'Date Only', durationUnit: 'Days', includedDays: 2 } }] })] };
assert.equal(report('Packages', {}, allDay).entries[0].reserved, 1); assert.equal(report('Packages', { utilizationDate: '2030-01-10' }, allDay).entries[0].reserved, 0);
assert.match(csvText([['=HYPERLINK("bad")']]), /'=/);
const saved = await validatedSales('one', 'saved_report', { ...blankReportFilter, name: 'Daily inventory', report: 'Daily Utilization', utilizationDate: '2030-01-09', group: 'Bundles', columns: ['Name', 'Reserved'], sort: 'Reserved (highest first)' });
assert.equal(saved.utilizationDate, '2030-01-09'); assert.equal(saved.group, 'Bundles'); assert.deepEqual(saved.columns, ['Name', 'Reserved']);
for (const patch of [{ group: 'Customers' }, { columns: ['secret'] }, { sort: 'invalid' }, { utilizationDate: '' }]) await assert.rejects(validatedSales('one', 'saved_report', { ...saved, ...patch }));
assert.match(buildReport(data, 'Utilization', { ...blankReportFilter }).note, /start date/, 'Legacy saved reports retain prior semantics');
console.log('Utilization report tests passed');
