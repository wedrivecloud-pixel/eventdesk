import {
  prettyDate,
  type Data,
  type EventRecord,
  type PackageRecord,
} from './crm';
import type { Resource } from './settings';

export const searchGroups = [
  'Clients',
  'Bookings',
  'Proposals',
  'Leads',
  'Packages',
  'Venues',
] as const;
export type SearchGroup = (typeof searchGroups)[number];
export type SearchClient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  events: EventRecord[];
};
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
  const clients = new Map<string, SearchClient>();
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
    // Distinct email addresses must remain distinct, even if the contacts share a name or phone.
    const email = event.email.trim().toLowerCase();
    const name = event.client.trim();
    if (!email && !name && !event.phone.trim()) continue;
    const key = email
      ? `email:${email}`
      : `contact:${normalizeSearch(name)}:${digits(event.phone) || event.id}`;
    let client = clients.get(key);
    if (!client) {
      client = {
        id: key,
        name: name || email || event.phone,
        email: event.email,
        phone: event.phone,
        events: [],
      };
      clients.set(key, client);
    }
    if (!client.phone && event.phone) client.phone = event.phone;
    client.events.push(event);
  }
  for (const client of clients.values()) {
    client.events.sort((a, b) =>
      (b.date || b.created_at).localeCompare(a.date || a.created_at),
    );
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
