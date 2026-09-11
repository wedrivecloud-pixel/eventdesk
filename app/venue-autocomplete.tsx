'use client';
import { useEffect, useId, useRef, useState } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import { MapPin } from 'lucide-react';
import {
  matchVenues,
  venueLocation,
  type VenueSuggestion,
} from '@/lib/venue-autocomplete';
import './venue-autocomplete.css';

export function VenueAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  venues = [],
  mode = 'location',
  name,
  required = false,
  maxLength = 250,
  packageId,
  onBusyChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: VenueSuggestion) => void;
  venues?: VenueSuggestion[];
  mode?: 'location' | 'name' | 'address';
  name?: string;
  required?: boolean;
  maxLength?: number;
  packageId?: string;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false),
    [connected, setConnected] = useState<boolean>(),
    [remote, setRemote] = useState<{ query: string; items: VenueSuggestion[] }>(
      { query: '', items: [] },
    ),
    [searching, setSearching] = useState(false),
    [selecting, setSelecting] = useState(false),
    [notice, setNotice] = useState('');
  const session = useRef({ token: '', at: 0 }),
    generation = useRef(0),
    mounted = useRef(true),
    detailRequest = useRef<AbortController | null>(null);
  const token = () => {
    if (!session.current.token || Date.now() - session.current.at > 180000)
      session.current = { token: crypto.randomUUID(), at: Date.now() };
    return session.current.token;
  };
  useEffect(() => {
    onBusyChange?.(selecting);
    return () => onBusyChange?.(false);
  }, [selecting, onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      detailRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    if ((!packageId && !open) || connected !== undefined) return;
    const c = new AbortController();
    fetch(
      '/api/places' +
        (packageId ? '?' + new URLSearchParams({ package: packageId }) : ''),
      { signal: c.signal },
    )
      .then(async (r) =>
        r.ok
          ? ((await r.json()) as { connected: boolean })
          : { connected: false },
      )
      .then((j) => {
        if (!c.signal.aborted) setConnected(j.connected === true);
      })
      .catch(() => {
        if (!c.signal.aborted) setConnected(false);
      });
    return () => c.abort();
  }, [open, connected, packageId]);
  useEffect(() => {
    if (!open || !connected || value.trim().length < 3 || selecting) {
      setSearching(false);
      return;
    }
    const c = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: c.signal,
        body: JSON.stringify({
          action: 'suggest',
          query: value.trim(),
          sessionToken: token(),
          ...(packageId ? { packageId } : {}),
        }),
      })
        .then(async (r) => {
          const j = (await r.json()) as {
            error?: string;
            suggestions?: VenueSuggestion[];
          };
          if (!r.ok)
            throw Error(j.error || 'Online suggestions are unavailable.');
          return j;
        })
        .then((j) => {
          if (!c.signal.aborted) {
            setRemote({ query: value, items: j.suggestions || [] });
            setNotice('');
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) {
            setRemote({ query: value, items: [] });
            setNotice(e.message + ' You can enter the address manually.');
          }
        })
        .finally(() => {
          if (!c.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [value, open, connected, selecting, packageId]);
  const saved = matchVenues(venues, value),
    online = remote.query === value && connected ? remote.items : [],
    items = [...saved, ...online];
  const apply = (v: VenueSuggestion) => {
    const text =
      mode === 'name'
        ? v.name
        : mode === 'address'
          ? packageId
            ? v.streetAddress || v.address
            : v.address
          : venueLocation(v);
    if (text.length > maxLength) {
      setNotice(
        `This location exceeds ${maxLength} characters. Enter a shorter version manually.`,
      );
      return;
    }
    onChange(text);
    onSelect?.(v);
    setOpen(false);
    setRemote({ query: '', items: [] });
    setNotice('Location filled in. You can edit it before saving.');
  };
  async function choose(v: VenueSuggestion) {
    const current = ++generation.current;
    detailRequest.current?.abort();
    if (v.source === 'saved') {
      setSelecting(false);
      apply(v);
      return;
    }
    const c = new AbortController();
    detailRequest.current = c;
    setSelecting(true);
    setNotice('Loading the full address…');
    try {
      const r = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: c.signal,
          body: JSON.stringify({
            action: 'details',
            placeId: v.id,
            sessionToken: token(),
            ...(packageId ? { packageId } : {}),
          }),
        }),
        j = (await r.json()) as { error?: string; venue: VenueSuggestion };
      if (!r.ok) throw Error(j.error || 'Unable to load this address.');
      if (mounted.current && generation.current === current) apply(j.venue);
    } catch (e) {
      if (
        mounted.current &&
        generation.current === current &&
        !c.signal.aborted
      )
        setNotice(
          (e instanceof Error ? e.message : 'Unable to load this address.') +
            ' You can enter it manually.',
        );
    } finally {
      if (mounted.current && generation.current === current) {
        setSelecting(false);
        session.current = { token: '', at: 0 };
      }
    }
  }
  return (
    <div className="field venue-autocomplete">
      <label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      {name && <input type="hidden" name={name} value={value} />}
      <Combobox<VenueSuggestion>
        disabled={disabled}
        items={items}
        filter={null}
        value={null}
        inputValue={value}
        open={open}
        onOpenChange={setOpen}
        itemToStringLabel={(v) =>
          mode === 'address' && v.source === 'saved' ? v.address : v.name
        }
        onInputValueChange={(text, detail) => {
          if (
            !['input-change', 'clear-press', 'input-paste'].includes(
              detail.reason,
            )
          )
            return; // Ignore popup-close resets so free-typed locations survive blur.
          generation.current++;
          detailRequest.current?.abort();
          setSelecting(false);
          setNotice('');
          onChange(text);
        }}
        onValueChange={(v) => {
          if (v) void choose(v);
        }}
      >
        <ComboboxInput
          disabled={disabled}
          id={id}
          required={required}
          maxLength={maxLength}
          showTrigger={false}
          autoComplete="off"
          aria-describedby={id + '-help'}
          placeholder={
            mode === 'address'
              ? 'Start typing an address…'
              : 'Start typing a venue or address…'
          }
        />
        <ComboboxContent className="venue-suggestions">
          <ComboboxList>
            {items.map((v, index) => (
              <ComboboxItem
                key={v.source + ':' + v.id}
                value={v}
                className={
                  v.source === 'google' && index === saved.length
                    ? 'venue-google-start'
                    : ''
                }
              >
                <MapPin size={16} />
                <span className="venue-suggestion-text">
                  <strong>
                    {mode === 'address' && v.source === 'saved'
                      ? v.address
                      : v.name}
                  </strong>
                  <small>
                    {mode === 'address' && v.source === 'saved'
                      ? v.name
                      : v.address}
                  </small>
                  {v.source === 'saved' && <small>Saved venue</small>}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
          {online.length > 0 && (
            <div className="venue-attribution" translate="no">
              Google Maps
            </div>
          )}
          <p className="venue-search-status" role="status">
            {selecting
              ? 'Loading address…'
              : searching
                ? 'Searching…'
                : items.length
                  ? 'Select a match, or keep typing your own location.'
                  : connected && value.trim().length < 3
                    ? 'Type at least 3 characters.'
                    : 'No matching venues. You can enter the location manually.'}
          </p>
        </ComboboxContent>
      </Combobox>
      <small id={id + '-help'} role="status">
        {notice ||
          (connected === false
            ? packageId
              ? 'Enter the venue and address below. Address suggestions are currently unavailable.'
              : 'Suggestions use your saved venues. Online address lookup is not connected.'
            : 'Choose a suggestion to fill in the location, or enter it manually.')}
      </small>
    </div>
  );
}
