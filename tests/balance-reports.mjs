import './sales-reports.mjs';
import assert from 'node:assert/strict';
const { buildBalanceReport, remainingSchedule } = await import('../work/sales-unit/balance-reports.mjs');
const e = { id: 'e', title: 'Wedding', client: 'Alex', email: 'alex@example.test', phone: '', venue: 'Garden', date: '2026-10-01', status: 'confirmed', lifecycle: 'Active', total: 100000, deposit: 20000, items: [{ service: 'DJs' }], operations: { quote: { dueDate: '2026-09-30' }, paymentPlan: { schedule: [
  { date: '2026-09-20', amount: 50000, label: 'Installment 2' },
  { date: '2026-09-01', amount: 20000, label: 'Deposit' },
  { date: '2026-09-10', amount: 30000, label: 'Installment 1' },
] } } };
const data = { events: [e, { ...e, id: 'lead', status: 'lead' }, { ...e, id: 'canceled', lifecycle: 'Canceled' }, { ...e, id: 'proposal', status: 'proposal' }], payments: [
  { event_id: 'e', amount: 35000, tip: 10000 }, { event_id: 'e', amount: 10000, voided_at: '2026-09-12' },
], settings: { timezone: 'America/Los_Angeles' } };
const f = { from: '', to: '', search: '', status: 'All', group: 'Packages' };
const run = (name, filter = {}, source = data) => buildBalanceReport(source, name, { ...f, ...filter }, '2026-09-13');
const outstanding = run('Outstanding Balances');
assert.equal(outstanding.rows.length, 1);
assert.equal(outstanding.totals['Balance USD'], 650);
assert.equal(outstanding.totals['Paid USD'], 350, 'Tips and voids excluded');
assert.equal(outstanding.rows[0][0], '2026-09-10');
assert.equal(outstanding.rows[0].at(-1), 3);
assert.equal(outstanding.totals['Deposit outstanding USD'], 0);
const scheduled = run('Scheduled Payments');
assert.equal(scheduled.rows.length, 2);
assert.equal(scheduled.totals['Amount remaining USD'], 650);
assert.equal(scheduled.rows[0][6], 150, 'Part-paid installment');
assert.equal(run('Scheduled Payments', { dueFrom: '2026-09-20', dueTo: '2026-09-20' }).totals['Amount remaining USD'], 500, 'Allocate all payments before date filtering');
assert.equal(run('Scheduled Payments', { dueStatus: 'Past due' }).totals['Amount remaining USD'], 150);
assert.equal(run('Scheduled Payments', { minAmount: '200' }).rows.length, 1);
assert.equal(run('Outstanding Balances', { status: 'proposal' }).balanceEventIds[0], 'proposal');
assert.equal(run('Outstanding Balances', { service: 'Venues' }).rows.length, 0);
assert.equal(run('Outstanding Balances', { hasPlan: 'No' }).rows.length, 0);
assert.equal(run('Outstanding Balances', { search: 'garden', columns: ['Event'] }).rows[0][0], 'Wedding');
assert.equal(run('Outstanding Balances', { from: '2026-10-02' }).rows.length, 0);
assert.ok(run('Scheduled Payments', { dueFrom: '2026-10-01', dueTo: '2026-09-01' }).error);
assert.ok(run('Outstanding Balances', { minAmount: '-1' }).error);
assert.ok(run('Outstanding Balances', { minAmount: '500', maxAmount: '100' }).error);
const noPlan = { ...e, operations: { quote: { dueDate: '2026-09-30' } } };
assert.deepEqual(remainingSchedule(noPlan, 35000), [{ date: '2026-09-30', label: 'Final balance', type: 'Final Balance', amount: 100000, remaining: 65000 }]);
assert.equal(run('Scheduled Payments', { paymentType: 'Final Balance' }, { ...data, events: [noPlan] }).rows.length, 1);
assert.equal(run('Scheduled Payments', {}, { ...data, events: [e], payments: [{ event_id: 'e', amount: 110000 }] }).rows.length, 0, 'Overpaid events excluded');
assert.equal(remainingSchedule({ ...e, total: 60000 }, 35000).reduce((s,r) => s + r.remaining, 0), 25000, 'Old plan capped after quote reduction');
assert.equal(remainingSchedule({ ...e, total: 120000 }, 35000).at(-1).remaining, 20000, 'Additional quote amount becomes final balance');
assert.equal(run('Outstanding Balances', { dueStatus: 'Due today' }, { ...data, events: [{ ...noPlan, operations: { quote: { dueDate: '2026-09-13' } } }] }).rows.length, 1);
console.log('Balance reports: partial allocations, voids/tips, lifecycle, plan reconciliation, filters, totals and columns passed.');
