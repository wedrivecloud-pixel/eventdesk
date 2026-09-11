'use client';
import { useState, useEffect } from 'react';
import { VenueAutocomplete } from './venue-autocomplete';
import {
  bookingVenueLines,
  venueFromSuggestion,
  type BookingVenue,
} from '@/lib/booking-venue';

export function BookingVenueFields({
  value,
  onChange,
  packageId,
  onBusyChange,
}: {
  value: BookingVenue;
  onChange: (v: BookingVenue) => void;
  packageId: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [nameBusy, setNameBusy] = useState(false),
    [addressBusy, setAddressBusy] = useState(false);
  useEffect(() => {
    onBusyChange(nameBusy || addressBusy);
    return () => onBusyChange(false);
  }, [nameBusy, addressBusy, onBusyChange]);
  const field = (
    key: keyof BookingVenue,
    label: string,
    maxLength: number,
    autoComplete: string,
  ) => (
    <label className="cb-field">
      <span>{label}</span>
      <input
        value={value[key]}
        maxLength={maxLength}
        autoComplete={autoComplete}
        disabled={nameBusy || addressBusy}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="cb-venue-fields">
      <VenueAutocomplete
        label="Venue name (optional)"
        mode="name"
        value={value.name}
        maxLength={120}
        packageId={packageId}
        onChange={(name) => onChange({ ...value, name })}
        onSelect={(v) => onChange(venueFromSuggestion(v, value))}
        disabled={addressBusy}
        onBusyChange={setNameBusy}
      />
      <VenueAutocomplete
        label="Street address"
        mode="address"
        value={value.address}
        maxLength={250}
        required
        packageId={packageId}
        onChange={(address) => onChange({ ...value, address })}
        onSelect={(v) => onChange(venueFromSuggestion(v, value, true))}
        disabled={nameBusy}
        onBusyChange={setAddressBusy}
      />
      {field(
        'address2',
        'Apartment, suite, floor or room (optional)',
        120,
        'section-venue address-line2',
      )}
      <div className="cb-grid">
        {field('city', 'City', 100, 'section-venue address-level2')}
        {field(
          'state',
          'State / province',
          100,
          'section-venue address-level1',
        )}
        {field(
          'postalCode',
          'ZIP / postal code',
          30,
          'section-venue postal-code',
        )}
        {field('country', 'Country', 80, 'section-venue country-name')}
      </div>
    </div>
  );
}
export function BookingVenueSummary({ venue }: { venue: BookingVenue | null }) {
  return (
    <div className="cb-venue-summary">
      <h3>Venue address</h3>
      {venue ? (
        <address>
          {bookingVenueLines(venue).map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </address>
      ) : (
        <p>Venue to be confirmed</p>
      )}
    </div>
  );
}
