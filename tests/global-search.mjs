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
const { buildSearchIndex, searchRecords } = load('lib/global-search.ts');
const event = (id, changes = {}) => ({
  id,
  title: 'José’s garden wedding',
  client: 'José Rivera',
  email: 'jose@example.test',
  phone: '(555) 123-4567',
  date: '2026-09-29',
  time: '17:00',
  venue: 'Palm Garden',
  status: 'confirmed',
  lifecycle: 'Active',
  items: [{ name: 'Bronze Photo Booth', service: 'Photo booths' }],
  total: 65000,
  created_at: '2026-09-09',
  ...changes,
});
const data = {
  business: { id: 'business-one' },
  events: [
    event('booking'),
    event('proposal', {
      status: 'proposal',
      email: 'JOSE@example.test',
      title: 'Holiday party',
    }),
    event('lead', {
      status: 'lead',
      client: 'Alana Lane',
      email: 'alana@example.test',
      phone: '555-888-7777',
    }),
    event('different-client', {
      email: 'another-jose@example.test',
      title: 'Birthday party',
    }),
    event('postponed', { lifecycle: 'Postponed' }),
    event('archived', { lifecycle: 'Archived' }),
    event('removed', {
      lifecycle: 'Deleted',
      client: 'Removed person',
      email: 'removed@example.test',
    }),
    event('spam', {
      lifecycle: 'Spam',
      client: 'Spam person',
      email: 'spam@example.test',
    }),
  ],
  packages: [
    {
      id: 'package',
      name: 'Bronze Photo Booth',
      service: 'Photo booths',
      duration: '4 hours',
      description: 'Garden celebration package',
      price: 49900,
      settings: { status: 'Private', group: 'Weddings' },
    },
  ],
  resources: [
    {
      id: 'venue',
      kind: 'venues',
      name: 'Palm Garden',
      data: {
        address: '123 Main Street, Phoenix AZ',
        contact: 'Alana',
        phone: '555-123-8888',
      },
      archived: 0,
    },
    {
      id: 'archived-venue',
      kind: 'venues',
      name: 'Old Palm Garden',
      data: {},
      archived: 1,
    },
    {
      id: 'unrelated',
      kind: 'staff',
      name: 'Palm Garden staff login',
      data: {},
      archived: 0,
    },
  ],
};
const index = buildSearchIndex(data);
const find = (query) =>
  searchRecords(index, query).flatMap((group) => group.entries);
const ids = (query) => find(query).map((item) => item.id);
assert.equal(searchRecords(index, '').length, 0);
assert.equal(searchRecords(index, 'a').length, 0);
assert.equal(searchRecords(index, '   --   ').length, 0);
assert.deepEqual(buildSearchIndex({ ...data, business: null }), []);
assert.equal(
  index.filter((item) => item.group === 'Clients').length,
  3,
  'merge repeated email case-insensitively; preserve different emails sharing a name',
);
const client = index.find(
  (item) => item.id === 'client:email:jose@example.test',
).target.client;
assert.equal(client.events.length, 4);
assert(
  ids('JOSE').includes('client:email:jose@example.test'),
  'accent/case insensitive name search',
);
assert(
  ids('jose@example.test').includes('event:proposal'),
  'email search matches event and client',
);
assert(
  ids('5551234567').includes('event:booking'),
  'digits match formatted phone',
);
assert(
  ids('(555) 123-4567').includes('client:email:jose@example.test'),
  'pasted formatted phone',
);
assert(!ids('5558887777').includes('client:email:jose@example.test'));
assert(
  ids('jose garden').includes('event:booking'),
  'all terms can match different fields',
);
assert.equal(find('jose unicorn').length, 0, 'all terms required');
assert(ids('2026-09-29').includes('event:booking'));
assert(ids('Sep 29').includes('event:booking'));
assert(ids('phoenix').includes('venue:venue'), 'venue address search');
assert(ids('Weddings').includes('package:package'), 'package group search');
assert(
  !index.some((item) =>
    [
      'event:removed',
      'event:spam',
      'venue:archived-venue',
      'venue:unrelated',
    ].includes(item.id),
  ),
);
assert.equal(
  find('removed person').length,
  0,
  'deleted contacts do not remain in client directory',
);
assert.equal(
  index.find((item) => item.id === 'event:postponed').status,
  'Postponed',
);
assert.equal(
  index.find((item) => item.id === 'event:archived').status,
  'Archived',
);
assert.equal(
  index.find((item) => item.id === 'package:package').status,
  'Private',
);
assert.equal(index.find((item) => item.id === 'event:lead').group, 'Leads');
assert.equal(
  index.find((item) => item.id === 'event:proposal').group,
  'Proposals',
);
assert.equal(
  index.find((item) => item.id === 'event:booking').target.event,
  data.events[0],
  'open the actual matching event',
);
assert.equal(
  index.find((item) => item.id === 'package:package').target.package,
  data.packages[0],
);
assert.equal(
  index.find((item) => item.id === 'venue:venue').target.venue,
  data.resources[0],
);
const refreshed = buildSearchIndex({
  ...data,
  packages: [
    { ...data.packages[0], name: 'New Package Title', description: '' },
  ],
});
assert.equal(
  searchRecords(refreshed, 'New Package Title')[0].entries[0].target.package.id,
  'package',
);
assert.equal(
  searchRecords(refreshed, 'Bronze Photo Booth')
    .flatMap((group) => group.entries)
    .filter((item) => item.group === 'Packages').length,
  0,
);
const otherBusiness = buildSearchIndex({
  business: { id: 'business-two' },
  events: [],
  packages: [],
  resources: [],
});
assert.equal(
  searchRecords(otherBusiness, 'jose').length,
  0,
  'no index retained across business data',
);
const many = buildSearchIndex({
  ...data,
  packages: Array.from({ length: 30 }, (_, n) => ({
    ...data.packages[0],
    id: `pkg-${n}`,
    name: n === 20 ? 'Photo Booth' : `A Photo Booth ${n}`,
  })),
});
const packageMatches = searchRecords(many, 'photo booth').find(
  (group) => group.group === 'Packages',
).entries;
assert.equal(packageMatches.length, 30, 'all matches available for Show more');
assert.equal(
  packageMatches[0].target.package.id,
  'pkg-20',
  'exact name ranks before partial match',
);
const withoutContact = buildSearchIndex({
  ...data,
  events: [event('no-contact', { client: '', email: '', phone: '' })],
});
assert.equal(
  withoutContact.filter((item) => item.group === 'Clients').length,
  0,
);
assert(
  data.events[0].id === 'booking' && data.events[1].id === 'proposal',
  'index must not reorder source records',
);
const {clientDirectory, matchesClient} = load('lib/clients.ts');
const directory = clientDirectory({ ...data, events: [
  event('old', {email:' Jose@example.test ', phone:'555-0101', updated_at:'2026-09-01'}),
  event('recent', {email:'JOSE@example.test', client:'José Updated', phone:'', updated_at:'2026-09-11'}),
  event('namesake', {email:'other@example.test'}),
  event('plus-address', {email:'jose+party@example.test'}),
  event('deleted-newer', {email:'JOSE@example.test', lifecycle:'Deleted', updated_at:'2026-09-12'}),
], resources: [
  {id:'customer', kind:'staff', name:'New Customer', archived:0, data:{email:'new@example.test', phone:'555-0103', customerRole:true}},
  {id:'staff', kind:'staff', name:'Private Staff', archived:0, data:{email:'staff@example.test', customerRole:false}},
  {id:'archived', kind:'staff', name:'Archived Customer', archived:1, data:{email:'archived@example.test', customerRole:true}},
]});
assert.equal(directory.length,4,'Repeated email deduplicates; distinct and plus addresses stay separate');
const recent=directory.find(c=>c.email==='jose@example.test');
assert.equal(recent.name,'José Updated');
assert.equal(recent.phone,'','Do not restore a phone cleared in the latest record');
assert.equal(recent.events.length,2);
assert(matchesClient(recent,'jose updated'));
assert(matchesClient(recent,'JOSE@example.test'));
assert(matchesClient(recent,'rivera'),'Previous contact names remain searchable');
assert(!matchesClient(recent,'other@example.test'));
assert.equal(directory.find(c=>c.email==='new@example.test').events.length,0);
assert.deepEqual(clientDirectory({...data,business:null}),[]);
assert.deepEqual(clientDirectory({business:{id:'other'},events:[],resources:[]}),[]);
console.log(
  'Global search: matching, grouping, contacts, record targets, lifecycle filtering, refresh, and business isolation passed.',
);
