import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor } from '@/db/store';
import { googleVenue } from '@/lib/venue-autocomplete';
import { bookingContext } from '@/db/public-booking';
import { publicPlacesLimit } from '@/db/places-rate-limit';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
const usage = new Map<string, { start: number; count: number }>();
// A short burst guard for signed-in business owners. Configure the provider's
// project quota as the authoritative spending cap across Worker instances.
function allow(id: string) {
  const now = Date.now();
  for (const [key, v] of usage) if (now - v.start >= 60000) usage.delete(key);
  const v = usage.get(id) || { start: now, count: 0 };
  if (v.count >= 30 || (!usage.has(id) && usage.size >= 2000)) return false;
  v.count++;
  usage.set(id, v);
  return true;
}
async function owner() {
  const user = await getChatGPTUser();
  return user && (await businessFor(user.userId)) ? user : null;
}
export async function GET(req?: Request) {
  try {
    const packageId = req && new URL(req.url).searchParams.get('package');
    if (packageId) {
      if (packageId.length > 100 || !(await bookingContext(packageId)))
        return json(
          { error: 'This package is not available for booking.' },
          404,
        );
    } else if (!(await owner()))
      return json({ error: 'Sign in to your business workspace.' }, 401);
    return json({ connected: Boolean(process.env.GOOGLE_PLACES_API_KEY) });
  } catch {
    return json({ connected: false }, 503);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return json({ error: 'Invalid origin.' }, 403);
    if (req.headers.get('sec-fetch-site') === 'cross-site')
      return json({ error: 'Invalid request source.' }, 403);
    if (Number(req.headers.get('content-length') || 0) > 2000)
      return json({ error: 'Search is too long.' }, 413);
    const raw = await req.text();
    if (raw.length > 2000) return json({ error: 'Search is too long.' }, 413);
    const body = JSON.parse(raw);
    let publicBid = '',
      ownerId = '';
    if (body?.packageId !== undefined) {
      if (
        typeof body.packageId !== 'string' ||
        !body.packageId ||
        body.packageId.length > 100
      )
        return json({ error: 'Choose a valid booking package.' }, 400);
      const c = await bookingContext(body.packageId);
      if (!c)
        return json(
          { error: 'This package is not available for booking.' },
          404,
        );
      publicBid = c.bid;
    } else {
      const user = await owner();
      if (!user)
        return json({ error: 'Sign in to your business workspace.' }, 401);
      ownerId = user.userId;
    }
    if (
      !['suggest', 'details'].includes(body?.action) ||
      !/^[-_a-zA-Z0-9]{16,36}$/.test(body.sessionToken || '')
    )
      return json({ error: 'Invalid search request.' }, 400);
    if (
      body.action === 'suggest' &&
      (typeof body.query !== 'string' ||
        body.query.trim().length < 3 ||
        body.query.length > 250)
    )
      return json({ error: 'Enter 3–250 characters.' }, 400);
    if (
      body.action === 'details' &&
      (typeof body.placeId !== 'string' ||
        !/^[-_a-zA-Z0-9]{1,250}$/.test(body.placeId))
    )
      return json({ error: 'Choose a valid place.' }, 400);
    if (!process.env.GOOGLE_PLACES_API_KEY)
      return json({ error: 'Online address lookup is not connected.' }, 503);
    if (publicBid) await publicPlacesLimit(req, publicBid);
    else if (!allow(ownerId))
      return json({ error: 'Too many searches. Try again in a minute.' }, 429);
    const suggest = body.action === 'suggest';
    const url = suggest
      ? 'https://places.googleapis.com/v1/places:autocomplete'
      : 'https://places.googleapis.com/v1/places/' +
        encodeURIComponent(body.placeId) +
        '?' +
        new URLSearchParams({ sessionToken: body.sessionToken });
    const r = await fetch(url, {
      method: suggest ? 'POST' : 'GET',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': suggest
          ? 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat'
          : 'id,displayName,formattedAddress,addressComponents,postalAddress',
      },
      ...(suggest
        ? {
            body: JSON.stringify({
              input: body.query.trim(),
              sessionToken: body.sessionToken,
              includeQueryPredictions: false,
            }),
          }
        : {}),
    });
    if (!r.ok)
      return json(
        {
          error:
            r.status === 429
              ? 'Address lookup is temporarily at capacity.'
              : 'Online address lookup is unavailable.',
        },
        502,
      );
    const data = (await r.json()) as any;
    if (suggest)
      return json({
        suggestions: (Array.isArray(data.suggestions) ? data.suggestions : [])
          .slice(0, 5)
          .flatMap((x: any) => {
            const p = x.placePrediction;
            return p?.placeId && p?.structuredFormat?.mainText?.text
              ? [
                  {
                    id: p.placeId,
                    source: 'google',
                    name: p.structuredFormat.mainText.text,
                    address: p.structuredFormat.secondaryText?.text || '',
                    city: '',
                    state: '',
                    postalCode: '',
                    country: '',
                  },
                ]
              : [];
          }),
      });
    const venue = googleVenue(data);
    if (!venue.id || !venue.address)
      return json(
        { error: 'No complete address was returned for this place.' },
        502,
      );
    return json({ venue });
  } catch (e) {
    if (e instanceof Error && e.message === 'PLACES_LIMIT')
      return json(
        {
          error:
            'Address lookup has reached its search limit. Please enter the address manually.',
        },
        429,
      );
    if (e instanceof SyntaxError)
      return json({ error: 'Invalid search request.' }, 400);
    return json({ error: 'Online address lookup is unavailable.' }, 502);
  }
}
