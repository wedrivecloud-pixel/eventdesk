import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const native = createRequire(import.meta.url), cache = new Map();
const members = [{ id: 'a', business_id: 'one' }, { id: 'old', business_id: 'one' }, { id: 'other', business_id: 'two' }];
const db = { prepare() { let args; return { bind(...v) { args = v; return this; }, async first() { return members.find((s) => s.id === args[0] && s.business_id === args[1]) || null; } }; } };
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
const { buildReport, blankReportFilter } = load('lib/sales-reports.ts');
const { defaultWeek } = load('lib/staff-scheduling.ts');
const week = defaultWeek(); week[0].mode = 'off'; week[1] = { mode: 'hours', start: '09:30', end: '17:45' };
const off = (id, patch = {}) => ({ id, kind: 'time_off', archived: 0, created_at: '2030-01-09T02:00:00Z', data: { staffId: 'a', start: '2030-01-09', end: '2030-01-11', allDay: true, status: 'Approved', notes: 'Vacation', ...patch } });
const data = { business: { id: 'one' }, events: [], packages: [], settings: { timezone: 'America/Los_Angeles', blackoutDates: '2030-01-09 2030-01-12 2030-01-09' }, resources: [
  { id: 'a', kind: 'staff', name: 'Alex', archived: 0, data: { bookingAvailability: week } },
  { id: 'b', kind: 'staff', name: 'Blair', archived: 0, data: {} },
  { id: 'old', kind: 'staff', name: 'Former', archived: 1, data: {} },
  { id: 'broken', kind: 'staff', name: 'Review', archived: 0, data: { bookingAvailability: [] } },
], sales: [off('off'), off('partial', { start: '2030-01-11', end: '2030-01-12', allDay: false, startTime: '22:00', endTime: '02:00', status: 'Pending', notes: 'Overnight' }), { ...off('archived'), archived: 1 }, off('old', { staffId: 'old', status: 'Declined' })] };
const report = (name, filters = {}, source = data) => buildReport(source, name, { ...blankReportFilter, ...filters });
const weekly = report('Staff Availability');
assert.deepEqual(weekly.headers, ['Staff member', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
assert.deepEqual(weekly.rows[0].slice(0, 4), ['Alex', 'Unavailable', '09:30 – 17:45', 'Available all day']);
assert.equal(weekly.rows.length, 3); assert.equal(weekly.rows[1][1], 'Available all day'); assert.equal(weekly.rows[2][1], 'Needs review');
assert.equal(report('Staff Availability', { staffId: 'other' }).rows.length, 0);
assert.equal(report('Staff Availability', { from: '2099-01-01', to: '2000-01-01' }).rows.length, 3, 'Weekly pattern is not date-filtered');
assert.equal(report('Staff Availability', { sort: 'Staff (Z–A)' }).rows[0][0], 'Review');
assert.equal(report('Staff Availability', { staffId: 'old' }).rows.length, 0, 'Archived staff excluded from weekly schedule');
const timeOff = report('Staff Time Off', { from: '2030-01-11', to: '2030-01-11' });
assert.equal(timeOff.rows.length, 3, 'Include overlapping all-day ranges and overnight partial time off');
assert.equal(timeOff.rows.find((r) => r[4] === 'Overnight')[1], '2030-01-11 22:00');
assert.equal(timeOff.rows.find((r) => r[4] === 'Overnight')[2], '2030-01-12 02:00');
assert.equal(report('Staff Time Off', { timeOffStatus: 'Approved', staffId: 'a' }).rows.length, 1);
assert.equal(report('Staff Time Off', { enteredFrom: '2030-01-08', enteredTo: '2030-01-08' }).rows.length, 3, 'Entered dates use business timezone');
assert.equal(report('Staff Time Off', { enteredFrom: '2030-01-09' }).rows.length, 0);
assert.equal(report('Staff Time Off', { search: 'former' }).rows[0][0], 'Former (archived)');
assert.equal(report('Staff Time Off', { sort: 'Start (newest first)' }).rows[0][4], 'Overnight');
assert.equal(report('Staff Time Off', { from: '2030-01-13' }).rows.length, 0);
assert.ok(report('Staff Time Off', { from: '2030-01-13', to: '2030-01-11' }).error);
assert.ok(report('Staff Time Off', { enteredFrom: '2030-01-13', enteredTo: '2030-01-11' }).error);
assert.deepEqual(report('Business Blockout Dates').rows, [['2030-01-09', '2030-01-09', 'Yes'], ['2030-01-12', '2030-01-12', 'Yes']]);
assert.equal(report('Business Blockout Dates', { from: '2030-01-10', to: '2030-01-12' }).rows.length, 1);
const projected = report('Staff Time Off', { columns: ['Reason', 'Staff member'], search: 'pending' });
assert.deepEqual(projected.headers, ['Staff member', 'Reason']); assert.deepEqual(projected.rows, [['Alex', 'Overnight']], 'Search works even when the matching column is hidden');
assert.deepEqual(report('Staff Availability', { columns: ['unknown'] }).headers, weekly.headers);
assert.equal(report('Blockouts & Availability').rows.length, 6, 'Legacy saved combined report remains supported');
assert.equal(report('Staff Time Off', {}, { ...data, sales: [] }).rows.length, 0);
const { csvText } = load('lib/sales.ts');
assert.match(csvText([['Staff', 'Reason'], ['Alex', '=unsafe']]), /'=/, 'Export escapes spreadsheet formulas');
console.log('PASS: weekly schedules/defaults, malformed schedule handling, staff/status/search filters, all-day/partial/overnight overlap, business timezone, archived staff/history, columns and CSV, date validation, legacy reports.');

const { validatedSales: validatedRecord } = load('db/sales.ts');
const input = { name: 'Staff leave', report: 'Staff Time Off', staffId: 'a', timeOffStatus: 'Pending', from: '2030-01-01', to: '2030-01-31', enteredFrom: '2030-01-01', enteredTo: '2030-01-31', sort: 'Entered (newest first)', columns: ['Staff member', 'Reason'], search: 'leave' };
const saved = await validatedRecord('one', 'saved_report', input);
for (const key of ['staffId', 'timeOffStatus', 'enteredFrom', 'enteredTo', 'sort', 'columns']) assert.deepEqual(saved[key], input[key]);
assert.equal((await validatedRecord('one', 'saved_report', { ...input, staffId: 'old' })).staffId, 'old');
for (const patch of [{ staffId: 'other' }, { timeOffStatus: 'Fake' }, { sort: 'Invalid' }, { columns: ['Unknown'] }, { columns: 'bad' }, { enteredTo: '2029-01-01' }]) await assert.rejects(() => validatedRecord('one', 'saved_report', { ...input, ...patch }));
assert.equal((await validatedRecord('one', 'saved_report', { name: 'Legacy', report: 'Blockouts & Availability' })).report, 'Blockouts & Availability');
console.log('PASS: saved report retains filters/columns, validates inputs and rejects another business’s staff.');
