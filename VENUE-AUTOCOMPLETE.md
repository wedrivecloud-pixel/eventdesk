# Venue and address suggestions

The booking/lead/proposal editor suggests active venues from the signed-in business's existing Places & venues records. Selecting a venue fills the existing venue/location field with its name and full address. Free typing remains supported, and choosing a suggestion never saves a record by itself.

The Places & venues editor supports suggestions in both Name and Address. Selecting a venue by name fills name, address, city, state and postal code. Selecting an address preserves an existing venue name. Other fields (contact, notes, capacity, media) stay as entered. Archived venues and other resource types are excluded. Suggestions use only resources already returned to the authorized business workspace.

## Online lookup connection

Google Places support is implemented but stays **off until configured**. No Google account, billing changes or API charges were initiated in this update. The server's `GET /api/places` reports connection status; clients never receive the API key.

To activate after the owner requests it:

1. Use the owner's Google Cloud project, enable billing and Places API (New), and set a conservative provider quota. The endpoint's per-user burst limit is per Worker instance and is not a global spending cap.
2. Configure `GOOGLE_PLACES_API_KEY` as a secret in the existing Site runtime. Restrict it to Places API (New); this implementation calls Google's web service from the server, so it does not use a browser/referrer key. Follow current Google guidance for supported server restrictions. Do not commit a key or paste it into source files.
3. Deploy the saved version to apply the runtime change. For local development only, use the same variable name in an ignored local environment file.
4. Verify a real venue and a street address, including city/state/postal code. Confirm the project's applicable Google Maps terms, attribution and end-user privacy/terms requirements before activating the provider for external users.

The autocomplete and details requests share a short-lived session token. Search waits 350ms after typing and requires at least three characters. Queries and fetched detail responses are not cached or logged by the feature. Selection fills the user's editable form; existing Save behavior persists the final form fields.

The admin endpoint requires a signed-in user with a business workspace. Customer booking lookup is also available anonymously when scoped to a valid, bookable package ID. The server derives its business from that package. Private saved venue lists are never exposed to customers. Public Google lookup has durable database limits of 60 requests per business/IP per 15 minutes and 1,000 requests per business per day; autocomplete and details both count. These supplement, and do not replace, Google project quotas. Missing credentials cause no provider calls.

## Customer booking

The customer flow is Contact → Event details → Venue → Review. The Venue step supports search by venue name or street address, followed by editable apartment/suite, city, state/province, postal code and country. Street address is required unless the customer selects “I haven't chosen a venue yet.” Selecting a new place clears an old suite; searching by address preserves an existing custom venue name. Manual entry remains available when the provider is unavailable, and typed text survives closing the suggestion popup.

Review shows the complete address and an Edit venue address action. Submission stores the structured venue in the customer request and a formatted location on the lead. The staff request review shows the original submitted address. Requests still need business approval and collect no payment. Selecting a venue or reviewing an estimate does not create a booking. Legacy booking requests remain supported. Inquiry forms are unchanged. No address validation, map, route calculation, geolocation permission or automatic travel fee calculation is added.

Checks: `node tests/venue-autocomplete.mjs`, `node tests/booking-venue.mjs`, TypeScript compilation and production build. Customer UI checks cover manual address entry, review/edit preservation and a venue to be confirmed. Provider responses are mocked until a real connection is authorized and configured.

References: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete ; https://developers.google.com/maps/documentation/places/web-service/get-api-key ; https://developers.google.com/maps/documentation/places/web-service/policies
