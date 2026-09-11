import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const native = createRequire(import.meta.url),
  cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const require = (p) => {
    if (!p.startsWith('.') && !p.startsWith('@/')) return native(p);
    const path = p.startsWith('@/')
      ? resolve(p.slice(2))
      : resolve(dirname(file), p);
    return load(path + (existsSync(path + '.ts') ? '.ts' : '.tsx'));
  };
  new Function(
    'require',
    'module',
    'exports',
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(require, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const {
  workspaceGroups,
  workspaceViews,
  workspaceHref,
  viewFromSearch,
  canonicalView,
  contextualLinks,
  scopeLinks,
  navigationParent,
} = load('lib/workspace-navigation.ts');
const { manageGroups } = load('lib/manage-config.ts');
const { userMenuGroups } = load('lib/user-account.ts');
const { defaultOverview, checkedOverview, presentOverview } = load(
  'lib/overview-preferences.ts',
);

// Every existing destination remains addressable, reloadable, and independently linkable.
const priorSections = [
  'Overview',
  'Leads',
  'Proposals',
  'Bookings',
  'Appointments',
  'To-do List',
  'Messages',
  'Staffing',
  'Expenses',
  'Packages',
  'Calendar',
  'Payments',
  'Reporting',
  'Manage',
  'Business settings',
  ...manageGroups.flat(),
  ...userMenuGroups.flat(),
];
for (const view of priorSections) {
  const href = workspaceHref(view);
  assert.equal(
    viewFromSearch(new URL(href, 'https://example.test').search),
    canonicalView(view),
    view,
  );
  if (view !== 'Overview')
    assert.notEqual(canonicalView(view), 'Overview', view);
}
assert.equal(
  new Set(workspaceViews.map(workspaceHref)).size,
  workspaceViews.length,
  'No destination URL collisions',
);
assert.equal(viewFromSearch('?section=not-a-page'), 'Overview');
assert.equal(viewFromSearch('?section=https%3A%2F%2Fexample.com'), 'Overview');
assert.equal(workspaceHref('Package Manager'), workspaceHref('Packages'));
assert.equal(workspaceHref('All Bookings'), workspaceHref('Bookings'));
assert.equal(
  workspaceHref('User accounts'),
  workspaceHref('Staff & user accounts'),
);
for (const view of [
  'My Calendar',
  'My Appointments',
  'My Bookings',
  'My Checklist',
]) {
  assert.equal(scopeLinks(view).length, 2);
  assert.equal(scopeLinks(view).filter((item) => item.view === view).length, 1);
  assert.equal(
    navigationParent(scopeLinks(view)[0].view),
    navigationParent(view),
  );
}
assert.deepEqual(
  contextualLinks('Automated messages').map((l) => l.view),
  ['Messages', 'Automated messages', 'Message templates', 'System templates'],
);
for (const group of workspaceGroups)
  for (const item of group.items) {
    for (const child of item.children || [item])
      assert.equal(workspaceViews.includes(child.view), true, child.view);
  }

// Only the previous default arrangement is adapted. User choices and the input stay intact.
const modern = defaultOverview();
assert.deepEqual(checkedOverview(modern), modern);
const previousOrder = [
  'summary',
  'attention',
  'proposals',
  'upcoming',
  'revenue',
  'recent',
  'messages',
  'leads',
  'payments',
  'followups',
  'services',
  'tools',
];
const previous = {
  widgets: previousOrder.map((id) => ({
    ...modern.widgets.find((w) => w.id === id),
    column: ['attention', 'recent', 'leads'].includes(id)
      ? 'main'
      : ['proposals', 'messages', 'payments'].includes(id)
        ? 'side'
        : 'full',
  })),
};
previous.widgets.find((w) => w.id === 'attention').limit = 11;
previous.widgets.find((w) => w.id === 'revenue').enabled = false;
const untouched = structuredClone(previous);
const adapted = presentOverview(previous);
assert.deepEqual(previous, untouched, 'No mutation of saved preferences');
assert.equal(adapted.widgets.find((w) => w.id === 'attention').limit, 11);
assert.equal(adapted.widgets.find((w) => w.id === 'revenue').enabled, false);
assert.deepEqual(
  adapted.widgets.map((w) => w.id),
  modern.widgets.map((w) => w.id),
);
assert.deepEqual(presentOverview(adapted), adapted, 'Idempotent presentation');
const customized = structuredClone(previous);
[customized.widgets[0], customized.widgets[1]] = [
  customized.widgets[1],
  customized.widgets[0],
];
assert.equal(
  presentOverview(customized),
  customized,
  'Custom arrangement preserved',
);
console.log(
  'Navigation regression checks passed: old destinations, shareable URLs, personal scopes, and dashboard preferences.',
);
