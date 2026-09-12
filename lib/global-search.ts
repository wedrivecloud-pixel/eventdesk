import {
  prettyDate,
  type Data,
  type EventRecord,
  type PackageRecord,
} from './crm';
import type { Resource } from './settings';
import { clientDirectory, type ClientContact } from './clients';

export const searchGroups = [
  'Clients',
  'Bookings',
  'Proposals',
  'Leads',
  'Packages',
  'Venues',
] as const;
export type SearchGroup = (typeof searchGroups)[number];
export type SearchClient = ClientContact;
export type SearchTarget =
  | { type: 'client'; client: SearchClient }
  | { type: 'event'; event: EventRecord }
  | { type: 'package'; package: PackageRecord }
  | { type: 'venue'; venue: Resource };
export type SearchEntry = {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  status?: string;
  target: SearchTarget;
  titleText: string;
  searchText: string;
};

export function normalizeSearch(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@]+/gu, ' ')
    .trim();
}
export function eventSearchStatus(event: EventRecord) {
  return event.lifecycle && event.lifecycle !== 'Active'
    ? event.lifecycle
    : event.status === 'confirmed'
      ? 'Confirmed'
      : event.status === 'proposal'
        ? 'Proposal'
        : 'Lead';
}
function entry(
  group: SearchGroup,
  title: string,
  subtitle: string,
  target: SearchTarget,
  fields: string[],
  status?: string,
): SearchEntry {
  const id =
    target.type === 'client'
      ? target.client.id
      : target.type === 'event'
        ? target.event.id
        : target.type === 'package'
          ? target.package.id
          : target.venue.id;
  return {
    id: `${target.type}:${id}`,
    group,
    title,
    subtitle,
    status,
    target,
    titleText: normalizeSearch(title),
    searchText: normalizeSearch([title, subtitle, ...fields].join(' ')),
  };
}
function digits(phone: string) {
  return phone.replace(/\D/g, '');
}

// The API has already scoped Data to the signed-in business. Never fetch or persist a separate client-side directory.
export function buildSearchIndex(data: Data): SearchEntry[] {
  if (!data.business) return [];
  const entries: SearchEntry[] = [];
  for (const event of data.events) {
    if (event.lifecycle === 'Deleted' || event.lifecycle === 'Spam') continue;
    const group =
      event.status === 'confirmed'
        ? 'Bookings'
        : event.status === 'proposal'
          ? 'Proposals'
          : 'Leads';
    entries.push(
      entry(
        group,
        event.title || event.client || 'Untitled event',
        [event.client, prettyDate(event.date), event.venue]
          .filter(Boolean)
          .join(' · '),
        { type: 'event', event },
        [
          event.id,
          event.email,
          event.phone,
          digits(event.phone),
          event.date,
          event.time,
          ...event.items.map((item) => `${item.name} ${item.service}`),
        ],
        eventSearchStatus(event),
      ),
    );
  }
  for (const client of clientDirectory(data)) {
    entries.push(
      entry(
        'Clients',
        client.name,
        [client.email, client.phone].filter(Boolean).join(' · '),
        { type: 'client', client },
        [
          digits(client.phone),
          ...client.events.flatMap((event) => [
            event.client,
            event.email,
            event.phone,
            digits(event.phone),
          ]),
        ],
      ),
    );
  }
  for (const pkg of data.packages) {
    entries.push(
      entry(
        'Packages',
        pkg.name,
        [pkg.service, pkg.duration].filter(Boolean).join(' · '),
        { type: 'package', package: pkg },
        [pkg.id, pkg.description, pkg.settings?.group || ''],
        pkg.settings?.status || 'Public',
      ),
    );
  }
  for (const venue of data.resources || []) {
    if (venue.kind !== 'venues' || venue.archived) continue;
    entries.push(
      entry(
        'Venues',
        venue.name,
        String(venue.data.address || 'Saved venue'),
        { type: 'venue', venue },
        [
          venue.id,
          String(venue.data.contact || ''),
          String(venue.data.phone || ''),
          digits(String(venue.data.phone || '')),
        ],
      ),
    );
  }
  return entries;
}

export function searchRecords(
  index: SearchEntry[],
  query: string,
): { group: SearchGroup; entries: SearchEntry[] }[] {
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return [];
  const terms = normalized.split(/\s+/);
  const matches = index.filter((item) =>
    terms.every((term) => item.searchText.includes(term)),
  );
  const score = (item: SearchEntry) =>
    item.titleText === normalized
      ? 100
      : item.titleText.startsWith(normalized)
        ? 80
        : terms.every((term) => item.titleText.includes(term))
          ? 60
          : 20;
  return searchGroups
    .map((group) => ({
      group,
      entries: matches
        .filter((item) => item.group === group)
        .sort(
          (a, b) =>
            score(b) - score(a) ||
            a.title.localeCompare(b.title) ||
            a.id.localeCompare(b.id),
        ),
    }))
    .filter((group) => group.entries.length);
}
