import type { Data, EventRecord } from './crm';

export type ClientContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  events: EventRecord[];
};

export const clientEmailKey = (email: string) => email.trim().toLowerCase();

// Data comes from the authenticated, business-scoped CRM snapshot. Contacts and
// their history use the same email identity as global search; no account is created.
export function clientDirectory(data: Data): ClientContact[] {
  if (!data.business) return [];
  const contacts = new Map<string, ClientContact>();
  const events = data.events
    .filter(e => e.lifecycle !== 'Deleted' && e.lifecycle !== 'Spam')
    .slice()
    .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
  for (const event of events) {
    const email = clientEmailKey(event.email);
    const name = event.client.trim();
    if (!email && !name && !event.phone.trim()) continue;
    const id = email ? `email:${email}` : `contact:${name.toLowerCase()}:${event.phone.replace(/\D/g, '') || event.id}`;
    let contact = contacts.get(id);
    if (!contact) {
      contact = { id, name: name || email || event.phone, email, phone: event.phone, events: [] };
      contacts.set(id, contact);
    }
    contact.events.push(event);
  }
  for (const resource of data.resources || []) {
    if (resource.kind !== 'staff' || resource.archived ||
      (resource.data.customerRole !== true && resource.data.customerRole !== 1)) continue;
    const email = clientEmailKey(String(resource.data.email || ''));
    if (!email || contacts.has(`email:${email}`)) continue;
    contacts.set(`email:${email}`, { id: `email:${email}`, name: resource.name, email,
      phone: String(resource.data.phone || ''), events: [] });
  }
  for (const contact of contacts.values()) contact.events.sort((a, b) =>
    (b.date || b.created_at).localeCompare(a.date || a.created_at));
  return [...contacts.values()].sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
}

export function matchesClient(contact: ClientContact, query: string) {
  const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const searchable = normalize([contact.name, contact.email,
    ...contact.events.map(e => e.client)].join(' '));
  return normalize(query).trim().split(/\s+/).every(word => searchable.includes(word));
}
