import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const native = createRequire(import.meta.url),
  cache = new Map(),
  env = process.env;
const previousPlacesKey=process.env.GOOGLE_PLACES_API_KEY;
delete process.env.GOOGLE_PLACES_API_KEY;
let user = { userId: 'owner-a' },
  hasBusiness = true;
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  function require(p) {
    if (p.endsWith('.css')) return {};
    if (p === 'cloudflare:workers') return { env };
    if (p === '@/db/public-booking')
      return { bookingContext: async () => null };
    if (p === '@/db/places-rate-limit')
      return {
        publicPlacesLimit: async () => {
          throw Error('Unexpected public search');
        },
      };
    if (p === '@/app/chatgpt-auth') return { getChatGPTUser: async () => user };
    if (p === '@/db/store')
      return {
        businessFor: async (id) =>
          hasBusiness ? { id: 'business-' + id } : null,
      };
    if (!p.startsWith('.') && !p.startsWith('@/')) return native(p);
    const path = p.startsWith('@/')
      ? resolve(p.slice(2))
      : resolve(dirname(file), p);
    return load(path + (existsSync(path + '.ts') ? '.ts' : '.tsx'));
  }
  new Function(
    'require',
    'module',
    'exports',
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
  )(require, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { savedVenues, matchVenues, venueLocation, googleVenue } = load(
  'lib/venue-autocomplete.ts',
);
const resources = [
  {
    id: 'a',
    kind: 'venues',
    name: 'Café Garden',
    archived: 0,
    data: {
      address: '100 Main St',
      city: 'Mesa',
      state: 'AZ',
      postalCode: '85201',
    },
  },
  {
    id: 'b',
    kind: 'venues',
    name: 'Café Garden',
    archived: 0,
    data: {
      address: '200 Main St',
      city: 'Tempe',
      state: 'AZ',
      postalCode: '85281',
    },
  },
  {
    id: 'old',
    kind: 'venues',
    name: 'Archived Garden',
    archived: 1,
    data: { address: 'Old' },
  },
  {
    id: 'staff',
    kind: 'staff',
    name: 'Private Staff',
    archived: 0,
    data: { address: 'Private address' },
  },
];
const original = structuredClone(resources),
  venues = savedVenues(resources);
assert.equal(venues.length, 2);
assert.deepEqual(
  matchVenues(venues, 'cafe mesa').map((v) => v.id),
  ['a'],
);
assert.deepEqual(
  matchVenues(venues, '85281').map((v) => v.id),
  ['b'],
);
assert.equal(matchVenues(venues, 'private').length, 0);
assert.equal(savedVenues(resources, 'a').length, 1);
assert.equal(
  venueLocation(venues[0]),
  'Café Garden — 100 Main St, Mesa, AZ, 85201',
);
assert.equal(
  venueLocation({ ...venues[0], address: '100 Main St, Mesa, AZ 85201' }),
  'Café Garden — 100 Main St, Mesa, AZ 85201',
);
assert.deepEqual(resources, original);
const place = {
  id: 'google-place',
  displayName: { text: 'Garden Hall' },
  formattedAddress: '10 High Street, London SW1A 1AA, UK',
  addressComponents: [
    { types: ['postal_town'], longText: 'London' },
    {
      types: ['administrative_area_level_1'],
      longText: 'England',
      shortText: 'England',
    },
    { types: ['postal_code'], longText: 'SW1A 1AA' },
    { types: ['country'], longText: 'United Kingdom', shortText: 'GB' },
  ],
};
assert.equal(googleVenue(place).city, 'London');
assert.equal(googleVenue(place).postalCode, 'SW1A 1AA');
assert.equal(googleVenue(place).address, place.formattedAddress);
assert.equal(
  googleVenue({ formattedAddress: 'Rural event location' }).address,
  'Rural event location',
);
const { VenueAutocomplete } = load('app/venue-autocomplete.tsx');
const html = renderToStaticMarkup(
  createElement(VenueAutocomplete, {
    label: 'Venue / location',
    value: 'A custom location',
    name: 'venue',
    venues,
    onChange: () => {},
  }),
);
assert.match(html, /role="combobox"/);
assert.match(html, /type="hidden" name="venue" value="A custom location"/);
assert.match(html, /maxLength="250"/i);

const api = load('app/api/places/route.ts');
let calls = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return Response.json(
    url.includes('autocomplete')
      ? {
          suggestions: [
            {
              placePrediction: {
                placeId: place.id,
                structuredFormat: {
                  mainText: { text: 'Garden Hall' },
                  secondaryText: { text: place.formattedAddress },
                },
              },
            },
          ],
        }
      : place,
  );
};
const sessionToken = '12345678-1234-1234-1234-123456789012';
const post = (body, origin = 'https://eventdesk.example') =>
  api.POST(
    new Request('https://eventdesk.example/api/places', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
try {
  user = null;
  assert.equal((await api.GET()).status, 401);
  assert.equal((await post({})).status, 401);
  user = { userId: 'owner-a' };
  hasBusiness = false;
  assert.equal((await api.GET()).status, 401);
  hasBusiness = true;
  assert.deepEqual(await (await api.GET()).json(), { connected: false });
  assert.equal(
    (await post({ action: 'suggest', query: 'Garden', sessionToken })).status,
    503,
  );
  assert.equal(calls.length, 0);
  env.GOOGLE_PLACES_API_KEY = 'test-only-placeholder';
  assert.deepEqual(await (await api.GET()).json(), { connected: true });
  assert.equal(
    (
      await post(
        { action: 'suggest', query: 'Garden', sessionToken },
        'https://different.example',
      )
    ).status,
    403,
  );
  assert.equal(
    (await post({ action: 'suggest', query: 'ab', sessionToken })).status,
    400,
  );
  assert.equal(
    (await post({ action: 'suggest', query: 'Garden', sessionToken: 'bad' }))
      .status,
    400,
  );
  assert.equal(
    (await post({ action: 'details', placeId: '../../secret', sessionToken }))
      .status,
    400,
  );
  assert.equal(
    (
      await post({
        action: 'details',
        placeId: 'https://evil.example',
        sessionToken,
      })
    ).status,
    400,
  );
  assert.equal(
    (await post({ action: 'suggest', query: 'a'.repeat(2200), sessionToken }))
      .status,
    413,
  );
  assert.equal(calls.length, 0);
  let result = await post({ action: 'suggest', query: 'Garden', sessionToken });
  assert.equal(result.status, 200);
  const suggestions = await result.json();
  assert.equal(suggestions.suggestions[0].name, 'Garden Hall');
  assert(!JSON.stringify(suggestions).includes(env.GOOGLE_PLACES_API_KEY));
  assert.equal(
    calls[0].url,
    'https://places.googleapis.com/v1/places:autocomplete',
  );
  assert.equal(JSON.parse(calls[0].options.body).sessionToken, sessionToken);
  assert.equal(
    calls[0].options.headers['X-Goog-Api-Key'],
    env.GOOGLE_PLACES_API_KEY,
  );
  result = await post({ action: 'details', placeId: place.id, sessionToken });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).venue.city, 'London');
  assert(calls[1].url.endsWith('?sessionToken=' + sessionToken));
  assert.equal(
    calls[1].options.headers['X-Goog-FieldMask'],
    'id,displayName,formattedAddress,addressComponents,postalAddress',
  );
  globalThis.fetch = async () =>
    Response.json(
      { error: { message: 'sensitive provider response' } },
      { status: 403 },
    );
  result = await post({ action: 'suggest', query: 'Garden', sessionToken });
  assert.equal(result.status, 502);
  assert(!(await result.text()).includes('sensitive'));
  for (let i = 0; i < 27; i++)
    await post({ action: 'suggest', query: 'Garden', sessionToken });
  assert.equal(
    (await post({ action: 'suggest', query: 'Garden', sessionToken })).status,
    429,
  );
  user = { userId: 'owner-b' };
  assert.equal(
    (await post({ action: 'suggest', query: 'Garden', sessionToken })).status,
    502,
  );
} finally {
  globalThis.fetch = nativeFetch;
  if(previousPlacesKey===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=previousPlacesKey;
}
console.log(
  'PASS: saved venue matching, manual entry, international address mapping, authentication, request validation, session continuity, disconnected fallback, sanitized errors and search burst limits. No business data changed or live provider requests made.',
);
