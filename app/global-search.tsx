'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Users,
  CalendarDays,
  FileText,
  Package,
  MapPin,
  ArrowUpRight,
  ArrowLeft,
  Mail,
  Phone,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  buildSearchIndex,
  searchRecords,
  normalizeSearch,
  eventSearchStatus,
  type SearchTarget,
  type SearchGroup,
} from '@/lib/global-search';
import { money, prettyDate, type Data } from '@/lib/crm';
import './global-search.css';

const icons = {
  Clients: Users,
  Bookings: CalendarDays,
  Proposals: FileText,
  Leads: Users,
  Packages: Package,
  Venues: MapPin,
};
export function GlobalSearch({
  data,
  disabled,
  onOpen,
}: {
  data: Data;
  disabled: boolean;
  onOpen: (target: Exclude<SearchTarget, { type: 'client' }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [limits, setLimits] = useState<Partial<Record<SearchGroup, number>>>(
    {},
  );
  const [clientId, setClientId] = useState<string>();
  const [shortcut, setShortcut] = useState('Ctrl K');
  const input = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const handoff = useRef(false);
  const index = useMemo(() => buildSearchIndex(data), [data]);
  const groups = useMemo(() => searchRecords(index, query), [index, query]);
  const clientEntry = index.find((item) => item.id === clientId);
  const client =
    clientEntry?.target.type === 'client'
      ? clientEntry.target.client
      : undefined;
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const hasQuery = normalizeSearch(query).length >= 2;

  function changeOpen(next: boolean) {
    if (next) {
      handoff.current = false;
      setQuery('');
      setLimits({});
      setClientId(undefined);
    }
    setOpen(next);
  }
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');
  }, []);
  useEffect(() => {
    if (disabled) return;
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.repeat ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'k'
      )
        return;
      // Do not interrupt an open editor or its unsaved changes.
      if (!open && document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      if (open) {
        setClientId(undefined);
        input.current?.focus();
      } else changeOpen(true);
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [disabled, open]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      client ? back.current?.focus() : input.current?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [clientId, open]);

  function select(target: SearchTarget) {
    if (target.type === 'client') {
      setClientId(`client:${target.client.id}`);
      return;
    }
    handoff.current = true;
    setOpen(false);
    onOpen(target);
  }
  return (
    <>
      <button
        type="button"
        className="global-search-trigger"
        aria-label="Search Eventdeskly"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+k Meta+k"
        disabled={disabled}
        onClick={() => changeOpen(true)}
      >
        <Search size={18} />
        <span>Search Eventdeskly…</span>
        <kbd>{shortcut}</kbd>
      </button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          className="global-search-dialog"
          initialFocus={input}
          finalFocus={() => (handoff.current ? false : true)}
        >
          <DialogHeader>
            <DialogTitle>
              {client ? client.name : 'Search your workspace'}
            </DialogTitle>
            <DialogDescription>
              {client
                ? 'Client contact and related events'
                : 'Find clients, bookings, proposals, leads, packages, and venues.'}
            </DialogDescription>
          </DialogHeader>
          {client ? (
            <div className="global-search-client">
              <button
                type="button"
                ref={back}
                className="global-search-back"
                onClick={() => setClientId(undefined)}
              >
                <ArrowLeft size={16} />
                Back to results
              </button>
              <div className="global-search-contact">
                {client.email && (
                  <p>
                    <Mail size={17} />
                    <span>{client.email}</span>
                  </p>
                )}
                {client.phone && (
                  <p>
                    <Phone size={17} />
                    <span>{client.phone}</span>
                  </p>
                )}
                {!client.email && !client.phone && (
                  <p>No email or phone saved yet.</p>
                )}
              </div>
              <h3>
                Related records <span>{client.events.length}</span>
              </h3>
              <div className="global-search-related">
                {client.events.map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => select({ type: 'event', event })}
                  >
                    <span>
                      <strong>{event.title || 'Untitled event'}</strong>
                      <small>
                        {prettyDate(event.date)} · {money(event.total)}
                      </small>
                    </span>
                    <span className="global-search-badge">
                      {eventSearchStatus(event)}
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Command shouldFilter={false} loop label="Workspace search">
              <CommandInput
                ref={input}
                value={query}
                onValueChange={(value) => {
                  setQuery(value);
                  setLimits({});
                }}
                placeholder="Search a name, email, phone, or venue…"
                aria-label="Search workspace records"
                maxLength={160}
              />
              <div
                className="global-search-count"
                role="status"
                aria-live="polite"
              >
                {hasQuery
                  ? `${total} ${total === 1 ? 'result' : 'results'}`
                  : 'Type at least 2 characters to search'}
              </div>
              <CommandList aria-label="Search results">
                {!hasQuery ? (
                  <div className="global-search-empty">
                    <Search size={28} />
                    <strong>Find what you need, wherever you are.</strong>
                    <p>Try a client’s name, an event date, or a package.</p>
                  </div>
                ) : total === 0 ? (
                  <div className="global-search-empty">
                    <Search size={28} />
                    <strong>No matches found</strong>
                    <p>Try a different name, email, phone, or fewer words.</p>
                  </div>
                ) : (
                  groups.map(({ group, entries }) => {
                    const Icon = icons[group];
                    const limit = limits[group] || 5;
                    return (
                      <CommandGroup
                        key={group}
                        heading={`${group} · ${entries.length}`}
                      >
                        {entries.slice(0, limit).map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.id}
                            className="global-search-result"
                            onSelect={() => select(item.target)}
                          >
                            <span
                              className={`global-search-icon search-${group.toLowerCase()}`}
                            >
                              <Icon size={19} />
                            </span>
                            <span className="global-search-result-copy">
                              <strong>{item.title}</strong>
                              <small>{item.subtitle}</small>
                            </span>
                            {item.status && (
                              <span className="global-search-badge">
                                {item.status}
                              </span>
                            )}
                            <span className="global-search-result-arrow">
                              <ArrowUpRight size={16} />
                            </span>
                          </CommandItem>
                        ))}
                        {entries.length > limit && (
                          <CommandItem
                            className="global-search-more"
                            value={`more:${group}`}
                            onSelect={() =>
                              setLimits((current) => ({
                                ...current,
                                [group]: limit + 10,
                              }))
                            }
                          >
                            Show more {group.toLowerCase()} (
                            {entries.length - limit} remaining)
                          </CommandItem>
                        )}
                      </CommandGroup>
                    );
                  })
                )}
              </CommandList>
              <div className="global-search-footer">
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> Navigate <kbd>↵</kbd> Open
                </span>
                <span>
                  <kbd>Esc</kbd> Close
                </span>
              </div>
            </Command>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
