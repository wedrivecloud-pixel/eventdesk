'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from '@/components/ui/combobox';
import { clientDirectory, clientEmailKey, matchesClient, type ClientContact } from '@/lib/clients';
import type { Data, EventRecord } from '@/lib/crm';
import './client-picker.css';

export function ClientPicker({ data, defaults }: { data: Data; defaults: Partial<EventRecord> }) {
  const contacts = useMemo(() => clientDirectory(data), [data]);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [selected, setSelected] = useState<ClientContact | null>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState(defaults.client || '');
  const [email, setEmail] = useState(defaults.email || '');
  const [phone, setPhone] = useState(defaults.phone || '');
  const nameRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const match = contacts.find(c => c.email && c.email === clientEmailKey(email));
  const filtered = useMemo(() => (selected ? contacts : contacts.filter(c => matchesClient(c, query))).slice(0, 50), [contacts, selected, query]);
  function select(contact: ClientContact | null) {
    setSelected(contact);
    setQuery(contact ? `${contact.name} · ${contact.email}` : '');
    setName(contact?.name || '');
    setEmail(contact?.email || '');
    setPhone(contact?.phone || '');
  }
  function addNew() {
    const value = selected ? '' : query.trim();
    select(null);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) setEmail(value);
    else setName(value.slice(0, 120));
    nameRef.current?.focus();
  }
  function changed() {
    setSelected(null);
    setQuery('');
  }
  return <section className="client-picker" aria-label="Proposal client">
    <div className="client-picker-heading"><h3>Client</h3>
      <button className="secondary" type="button" disabled={!ready} onClick={addNew}>Add new client</button>
    </div>
    <label htmlFor={id}>Find an existing client</label>
    <Combobox items={contacts} filteredItems={filtered} value={selected}
      onValueChange={contact => { if (contact) select(contact); else setSelected(null); }} inputValue={query}
      onInputValueChange={(value, details) => {
        // Preserve the query when the popup closes so Add new can reuse it.
        if (details.reason === 'input-change') { setQuery(value); setSelected(null); }
      }} filter={null} limit={50}
      itemToStringLabel={c => `${c.name} · ${c.email}`}
      isItemEqualToValue={(a, b) => a.id === b.id}>
      <ComboboxInput id={id} disabled={!ready} placeholder="Search by name or email" autoComplete="off" />
      <ComboboxContent className="client-picker-popup">
        <ComboboxEmpty>No matching clients. Choose “Add new client” to enter their details.</ComboboxEmpty>
        <ComboboxList>{(contact: ClientContact) => <ComboboxItem key={contact.id} value={contact}>
          <div className="client-picker-result"><strong>{contact.name}</strong><span>{contact.email || 'No email saved'}</span>
            <small>{contact.events.length ? `${contact.events.length} past or upcoming event${contact.events.length === 1 ? '' : 's'}` : 'Saved customer'}</small></div>
        </ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>
    <div className="form-grid">
      <label className="field"><span>Client name</span><input ref={nameRef} name="client" required maxLength={120} autoComplete="name" value={name} onChange={e => { changed(); setName(e.target.value); }} /></label>
      <label className="field"><span>Client email</span><input name="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => { changed(); setEmail(e.target.value); }} /></label>
      <label className="field"><span>Phone (optional)</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
    </div>
    <p className="client-picker-note" role="status">{match
      ? `Existing client: ${match.name}. This proposal will appear with their other events in client search.`
      : 'Enter a new client’s details here, or select an existing client above.'}</p>
    {match && !selected && <button type="button" className="secondary" onClick={() => select(match)}>Use saved contact details</button>}
  </section>;
}
