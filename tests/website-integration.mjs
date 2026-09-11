import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolve, dirname } from 'node:path';

// Load the real pure helpers without a Cloudflare database runtime.
const cache = new Map();
const nodeRequire = createRequire(import.meta.url);
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {},
    module = { exports };
  cache.set(file, exports);
  const require = (p) => {
    if (p.endsWith('.css')) return {};
    if (!p.startsWith('.') && !p.startsWith('@/')) return nodeRequire(p);
    if (file.endsWith('manage-public.ts') && ['./raw', './store'].includes(p))
      return new Proxy(
        {},
        {
          get: () => () => {
            throw Error('Unexpected database access in pure tests');
          },
        },
      );
    const path = p.startsWith('@/')
      ? resolve(p.slice(2))
      : resolve(dirname(file), p);
    return load(path + (existsSync(path + '.ts') ? '.ts' : '.tsx'));
  };
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  new Function('require', 'module', 'exports', js)(require, module, exports);
  cache.set(file, module.exports);
  return module.exports;
}
const {
  integrationTools,
  integrationPath,
  integrationCode,
  widgetDefaults,
  widgetOptions,
  optionsFromQuery,
  safeHttps,
} = load('lib/website-integration.ts');
assert.equal(integrationTools.length, 11);
assert.equal(safeHttps('javascript:alert(1)'), '');
assert.equal(safeHttps('https://user:password@example.com'), '');
assert.equal(
  safeHttps('https://client.example/signin'),
  'https://client.example/signin',
);
const clean = widgetOptions({
  font: 'Arial; background:url(evil)',
  textColor: 'red',
  button: 'false',
  pageSize: 0,
  height: Infinity,
  categoryIds: ['one', 'one', '<script>'],
  customBookingUrl: 'data:text/html,hello',
});
assert.equal(clean.font, widgetDefaults().font);
assert.equal(clean.textColor, widgetDefaults().textColor);
assert.equal(clean.button, true);
assert.equal(clean.pageSize, 1);
assert.equal(clean.height, 800);
assert.deepEqual(clean.categoryIds, ['one']);
assert.equal(clean.customBookingUrl, '');
assert.deepEqual(optionsFromQuery({ widget: '{broken' }), widgetDefaults());
const options = {
  ...widgetDefaults(),
  embed: true,
  buttonText: 'Reserve "Gold" <now>',
  categoryIds: ['gold'],
};
const origin = 'https://eventdesk.example';
const book = integrationPath('book', { business: 'b' }, options);
assert.equal(book, '/reservation/start?business=b');
assert.equal(
  integrationPath('package', { business: 'b', packageId: 'pkg' }, options),
  '/book/pkg',
);
const group = new URL(
  integrationPath(
    'package',
    { business: 'b', service: 'Photo Booth', group: 'Gold & Silver' },
    options,
  ),
  origin,
);
assert.equal(group.searchParams.get('group'), 'Gold & Silver');
assert.equal(group.searchParams.get('business'), 'b');
assert.equal(integrationPath('signin', { business: 'b' }, options), '');
assert.equal(
  integrationPath(
    'mini',
    { business: 'b', externalUrl: 'javascript:alert(1)' },
    options,
  ),
  '',
);
assert.equal(integrationPath('appointments', { business: 'b' }, options), '');
const schedule = new URL(
  integrationPath(
    'appointments',
    { business: 'b', staffId: 's', calendarId: 'c' },
    options,
  ),
  origin,
);
assert.equal(schedule.pathname, '/schedule/s');
assert.equal(schedule.searchParams.get('calendar'), 'c');
const gallery = integrationPath('backdrops', { business: 'b' }, options);
assert.deepEqual(
  optionsFromQuery(Object.fromEntries(new URL(gallery, origin).searchParams)),
  widgetOptions(options),
);
const button = integrationCode(origin, book, 'Button', 'Book Online', options);
assert(button.includes('Reserve &quot;Gold&quot; &lt;now&gt;'));
assert(!button.includes('<now>'));
assert(button.includes('target="_top"'));
const standard = integrationCode(
  origin,
  gallery,
  'Embed on my site',
  'Gallery',
  options,
);
assert(standard.includes('data-eventdesk-src='));
assert(standard.includes('https://eventdesk.example/eventdesk-widgets.js'));
const compat = integrationCode(
  origin,
  gallery,
  'Embed on my site',
  'Gallery "title"',
  { ...options, compatibility: true },
);
assert(compat.startsWith('<iframe '));
assert(!compat.includes('<script'));
assert(compat.includes('title="Gallery &quot;title&quot;"'));

const { publicGalleryRows } = load('db/manage-public.ts');
const { emptyDetails } = load('lib/manage-config.ts');
const resource = (id, kind, data = {}, details = {}) => ({
  id,
  kind,
  name: id,
  archived: 0,
  data: { ...data, details: JSON.stringify({ ...emptyDetails(), ...details }) },
});
const rows = [
  resource('public', 'addons', { price: 10 }),
  resource('hidden', 'addons', { showGallery: false }),
  resource(
    'private',
    'addons',
    {},
    { packageMode: 'selected', packageIds: ['private-package'] },
  ),
  { ...resource('archived', 'addons'), archived: 1 },
  resource('hidden-category', 'categories', {
    ownerKind: 'addons',
    showGallery: false,
  }),
  resource('hidden-child', 'addons', { categoryId: 'hidden-category' }),
  resource('staff-private', 'staff', {
    email: 'secret@example.com',
    hourlyRate: 95,
  }),
  resource('staff-public', 'staff', {
    showGallery: true,
    bio: 'Public profile',
    email: 'secret@example.com',
    hourlyRate: 95,
  }),
  resource('collection', 'categories', { ownerKind: 'designs' }),
  resource('holiday', 'design_tags', { categoryId: 'collection' }),
  resource('other-tag', 'design_tags', { categoryId: 'another-collection' }),
  resource('template', 'designs', {
    categoryId: 'collection',
    preset: '2x6 3 Photo',
    tagIds: JSON.stringify(['holiday', 'other-tag']),
  }),
];
assert.deepEqual(
  publicGalleryRows(rows, 'addons', ['public-package']).map((r) => r.id),
  ['public'],
);
const staff = publicGalleryRows(rows, 'staff', ['public-package']);
assert.equal(staff.length, 1);
assert(!JSON.stringify(staff).includes('secret@example.com'));
assert.equal(staff[0].price, null);
assert.equal(staff[0].description, 'Public profile');
const designs = publicGalleryRows(rows, 'designs', ['public-package']);
assert.deepEqual(designs[0].tags, [{ id: 'holiday', name: 'holiday' }]);
assert.equal(designs[0].preset, '2x6 3 Photo');

// Render actual form and scheduler components with in-memory props only.
const Inquiry = load('app/inquiry/[id]/inquiry.tsx').default;
const inquiry = renderToStaticMarkup(
  createElement(Inquiry, {
    widget: {
      ...options,
      placeholders: true,
      wideButtons: true,
      font: 'Georgia, serif',
      buttonColor: '#123456',
    },
    initial: {
      id: 'form',
      name: 'Contact us',
      business: { id: 'b', name: 'Example business', color: '#315ee8' },
      fields: [
        {
          key: 'firstName',
          label: 'First name',
          display: 'Required',
          width: '50%',
        },
        { key: 'date', label: 'Event date', display: 'Optional', width: '50%' },
        { key: 'notes', label: 'Message', display: 'Optional', width: '100%' },
      ],
      questions: [],
      packages: [],
      button: 'Request details',
      privacy: {
        required: true,
        text: 'I agree',
        url: 'https://example.com/privacy',
      },
    },
  }),
);
assert(inquiry.includes('widget-wide-buttons'));
assert(inquiry.includes('font-family:Georgia, serif'));
assert(inquiry.includes('--widget-button:#123456'));
assert(inquiry.includes('placeholder="First name *"'));
assert(inquiry.includes('class="widget-label">Event date'));
assert(inquiry.includes('type="submit"'));
assert(inquiry.includes('Request details'));
assert(inquiry.includes('I agree'));
const Scheduler = load('app/schedule/[id]/scheduler.tsx').default;
const Frame = load('app/widget-frame.tsx').WidgetFrame;
const appointment = renderToStaticMarkup(
  createElement(
    Frame,
    { options },
    createElement(Scheduler, {
      selected: 'c2',
      data: {
        business: 'Example business',
        staffName: 'Jordan',
        staffId: 's',
        timezone: 'America/Los_Angeles',
        calendars: [
          {
            id: 'c1',
            name: 'Consultation',
            minutes: 15,
            invitation: 'Talk about your event',
          },
          {
            id: 'c2',
            name: 'Planning call',
            minutes: 30,
            invitation: 'Plan your event',
          },
        ],
      },
    }),
  ),
);
assert(appointment.includes('widget-embedded'));
assert(appointment.includes('Planning call'));
assert(appointment.includes('30 minutes'));
assert(appointment.includes('Appointments require approval'));

// Verify multiple widgets, idempotence and resize-message isolation with a DOM shim.
const listeners = [],
  nodes = [];
function host(src) {
  const h = {
    dataset: { eventdeskSrc: src, eventdeskTitle: 'Gallery' },
    children: [],
    appendChild(n) {
      this.children.push(n);
    },
  };
  nodes.push(h);
  return h;
}
const a = host(origin + '/gallery/b'),
  b = host(origin + '/inquiry/f');
const badOrigin = host('https://untrusted.example/gallery/b'),
  badRoute = host(origin + '/api/crm');
const context = {
  URL,
  Number,
  String,
  Math,
  document: {
    currentScript: { src: origin + '/eventdesk-widgets.js' },
    querySelectorAll: () => nodes.filter((n) => !n.dataset.eventdeskReady),
    createElement: (tag) => ({ tag, style: {}, contentWindow: {} }),
  },
  window: { addEventListener: (_, fn) => listeners.push(fn) },
};
const loader = readFileSync('public/eventdesk-widgets.js', 'utf8');
vm.runInNewContext(loader, context);
assert.equal(a.children.length, 2);
assert.equal(b.children.length, 2);
assert.equal(badOrigin.children.length, 0);
assert.equal(badRoute.children.length, 0);
vm.runInNewContext(loader, context);
assert.equal(a.children.length, 2);
assert.equal(listeners.length, 2);
const frame = a.children[0];
listeners[0]({
  origin: 'https://evil.example',
  source: frame.contentWindow,
  data: { type: 'eventdesk:resize', height: 999 },
});
assert.equal(frame.height, '800');
listeners[0]({
  origin,
  source: b.children[0].contentWindow,
  data: { type: 'eventdesk:resize', height: 999 },
});
assert.equal(frame.height, '800');
listeners[0]({
  origin,
  source: frame.contentWindow,
  data: { type: 'eventdesk:resize', height: 1100.2 },
});
assert.equal(frame.height, '1101');
listeners[0]({
  origin,
  source: frame.contentWindow,
  data: { type: 'eventdesk:resize', height: Infinity },
});
assert.equal(frame.height, '1101');
console.log(
  'PASS: all integration destinations, HTML escaping, customization validation, public gallery visibility and privacy, design tags, iframe compatibility, multiple embeds and resize isolation.',
);

if (process.argv.includes('--local')) {
  const base = 'http://localhost:3000';
  const snapshot = await fetch(base + '/api/crm', {
    headers: { Cookie: '__sites_local_auth=1' },
  }).then((r) => r.json());
  assert.equal(
    snapshot.business.id,
    'qa-business',
    'Local fixture business must match',
  );
  const bid = snapshot.business.id;
  const p = snapshot.packages.find(
    (p) =>
      snapshot.business.services.includes(p.service) &&
      (!p.settings?.status || p.settings.status === 'Public'),
  );
  assert(p, 'Existing public package required');
  for (const kind of [
    'addons',
    'backdrops',
    'designs',
    'staff',
    'availability',
  ]) {
    const path = integrationPath(
      kind,
      { business: bid },
      { ...options, categoryIds: [], packageIds: [p.id], showTags: true },
    );
    const response = await fetch(base + path);
    assert.equal(response.status, 200, kind);
    const html = await response.text();
    assert(html.includes('eventdesk-public-widget'), kind);
    assert(html.includes('widget-embedded'), kind);
    assert(!html.includes('secret@example.com'), kind);
  }
  const empty = await fetch(
    base +
      integrationPath(
        'addons',
        { business: bid },
        { ...options, categoryIds: ['nonexistent'] },
      ),
  ).then((r) => r.text());
  assert(empty.includes('No gallery items are currently available'));
  assert.equal(
    (await fetch(base + '/gallery/' + bid + '?kind=unknown')).status,
    404,
  );
  const foreign = await fetch(base + '/gallery/does-not-exist?kind=staff');
  assert.equal(foreign.status, 404);
  const date = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  const booking = await fetch(base + '/book/' + p.id + '?date=' + date);
  assert.equal(booking.status, 200);
  assert((await booking.text()).includes(date));
  const availability = await fetch(
    base +
      '/api/booking?' +
      new URLSearchParams({ package: p.id, date, minutes: String(p.minutes) }),
  );
  assert([200, 400].includes(availability.status));
  const availabilityData = await availability.json();
  assert(
    availability.status === 200
      ? typeof availabilityData.available === 'boolean'
      : typeof availabilityData.error === 'string',
  );
  const script = await fetch(base + '/eventdesk-widgets.js');
  assert.equal(script.status, 200);
  assert((await script.text()).includes('eventdesk:resize'));
  console.log(
    'PASS: read-only local widget pages, selected-category filtering, invalid scopes, booking-date handoff, availability API and hosted embed asset. No business records created.',
  );
}
