import { text } from './crm';
import type { VenueSuggestion } from './venue-autocomplete';

export type BookingVenue = {
  name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
export const emptyBookingVenue = (): BookingVenue => ({
  name: '',
  address: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
});
export function checkedBookingVenue(value: unknown): BookingVenue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value))
    throw Error('Enter a valid venue address.');
  const v = value as Record<string, unknown>;
  return {
    name: text(v.name ?? '', 'Venue name', 120, false),
    address: text(v.address ?? '', 'Street address', 250),
    address2: text(v.address2 ?? '', 'Apartment / suite', 120, false),
    city: text(v.city ?? '', 'City', 100, false),
    state: text(v.state ?? '', 'State / province', 100, false),
    postalCode: text(v.postalCode ?? '', 'Postal code', 30, false),
    country: text(v.country ?? '', 'Country', 80, false),
  };
}
export function bookingVenueLines(v: BookingVenue): string[] {
  return [
    v.name,
    v.address,
    v.address2,
    [v.city, [v.state, v.postalCode].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
    v.country,
  ].filter(Boolean);
}
export function bookingVenueText(v: BookingVenue): string {
  return bookingVenueLines(v).join(', ');
}
export function venueFromSuggestion(
  v: VenueSuggestion,
  previous: BookingVenue,
  preserveName = false,
): BookingVenue {
  return {
    name: preserveName && previous.name ? previous.name : v.name,
    address: v.streetAddress || v.address,
    address2: v.addressLine2 || '',
    city: v.city,
    state: v.state,
    postalCode: v.postalCode,
    country: v.country,
  };
}
