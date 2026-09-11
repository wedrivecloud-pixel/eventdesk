import { bookingQuestions } from '@/lib/manage-questions';
import { discountGuard } from '@/db/manage-guards';
import {
  bookingContext,
  bookingSelection,
  bookingQuote,
  availableOptions,
  digest,
} from '@/db/public-booking';
import { rawDb } from '@/db/raw';
import { text, email, date } from '@/lib/crm';
import {checkedBookingVenue,bookingVenueText} from '@/lib/booking-venue';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
export async function limit(req: Request, bid: string, action: string) {
  const ip = req.headers.get('x-eventdesk-client-ip') || 'unknown',
    time = Math.floor(Date.now() / 1000),
    window = Math.floor(time / 900),
    key = await digest([bid, action, ip, window].join(':')),
    max = action === 'submit' ? (ip === 'unknown' ? 40 : 8) : 180;
  const db = rawDb();
  await db
    .prepare(
      'DELETE FROM booking_rate_limits WHERE key IN (SELECT key FROM booking_rate_limits WHERE expires_at<? LIMIT 100)',
    )
    .bind(time)
    .run();
  const row = await db
    .prepare(
      'INSERT INTO booking_rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=booking_rate_limits.hits+1 WHERE booking_rate_limits.hits<? RETURNING hits',
    )
    .bind(key, (window + 1) * 900, max)
    .first();
  if (!row) throw Error('RATE_LIMIT');
}
function failure(e: unknown) {
  const m = e instanceof Error ? e.message : 'Unable to complete this request.';
  if (m === 'RATE_LIMIT')
    return reply(
      { error: 'Too many requests. Please try again in 15 minutes.' },
      429,
    );
  if (/D1_|SQLITE|R2_|Database unavailable/.test(m)) {
    console.error('Public booking operation failed');
    return reply(
      { error: 'Booking is temporarily unavailable. Please try again.' },
      503,
    );
  }
  return reply({ error: m }, 400);
}
export async function GET(req: Request) {
  try {
    const url = new URL(req.url),
      id = text(url.searchParams.get('package'), 'Package', 100),
      c = await bookingContext(id);
    if (!c)
      return reply(
        { error: 'This package is not available for booking.' },
        404,
      );
    await limit(req, c.bid, 'availability');
    const day = date(url.searchParams.get('date'), 'Event date'),
      minutes = Number(url.searchParams.get('minutes'));
    const slots = await availableOptions(c, day, minutes),
      times = slots.map((s) => s.time);
    return reply({
      available: c.p.settings!.dateMode === 'Date Only' || times.length > 0,
      times,
      slots,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return reply({ error: 'Invalid origin.' }, 403);
    if (req.headers.get('sec-fetch-site') === 'cross-site')
      return reply({ error: 'Invalid request source.' }, 403);
    if (Number(req.headers.get('content-length') || 0) > 16000)
      return reply({ error: 'Request too large.' }, 413);
    const raw = await req.text();
    if (raw.length > 16000) return reply({ error: 'Request too large.' }, 413);
    const body = JSON.parse(raw),
      c = await bookingContext(text(body.packageId, 'Package', 100));
    if (!c)
      return reply(
        { error: 'This package is not available for booking.' },
        404,
      );
    if (!['quote', 'submit'].includes(body.action))
      throw Error('Unknown booking action.');
    const input = bookingSelection(body, c);
    if (body.action === 'quote') {
      await limit(req, c.bid, 'quote');
      return reply((await bookingQuote(c, input)).view);
    }
    if (body.companyWebsite)
      throw Error('Unable to submit this form. Please contact the business.');
    if (body.acknowledged !== true)
      throw Error('Please confirm that this is a request for approval.');
    if (c.settings.requireConsent && body.consented !== true)
      throw Error('Please accept the privacy consent before submitting.');
    const venueDetails=checkedBookingVenue(body.venueDetails);
    const first = text(body.firstName, 'First name', 60),
      last = text(body.lastName, 'Last name', 60),
      client = text(first + ' ' + last, 'Name', 120),
      contact = email(body.email),
      phone = text(body.phone, 'Phone', 40),
      title = text(body.title, 'Event title', 150),
      venue = text(venueDetails?bookingVenueText(venueDetails):body.venue ?? '', 'Venue', 1000, false),
      notes = text(body.notes ?? '', 'Message', 3000, false),
      id = text(body.requestId, 'Request ID', 36);
    if (
      !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(
        id,
      )
    )
      throw Error('Refresh the page and try again.');
    const fingerprint = await digest(
      JSON.stringify({
        package: c.p.id,
        input,
        first,
        last,
        contact,
        phone,
        title,
        venue,
        ...(venueDetails?{venueDetails}:{}),
        notes,
        token: body.quoteToken,
      }),
    );
    const db = rawDb();
    const receipt = () =>
      reply({
        reference: id,
        status: 'pending',
        message:
          'Your booking request was received. The business will contact you to confirm availability and the final price. Your date is not reserved yet.',
      });
    const previous = await db
      .prepare(
        'SELECT e.business_id,o.data FROM events e LEFT JOIN event_operations o ON o.event_id=e.id AND o.business_id=e.business_id WHERE e.id=?',
      )
      .bind(id)
      .first<{ business_id: string; data: string }>();
    if (previous) {
      if (
        previous.business_id === c.bid &&
        JSON.parse(previous.data || '{}').requestDigest === fingerprint
      )
        return receipt();
      return reply(
        {
          error:
            'This request ID has already been used. Refresh the page before making a different request.',
        },
        409,
      );
    }
    await limit(req, c.bid, 'submit');
    const priced = await bookingQuote(c, input);
    if (body.quoteToken !== priced.view.token)
      return reply(
        {
          error:
            'Your estimate changed. Review the latest price before sending your request.',
          code: 'QUOTE_CHANGED',
        },
        409,
      );
    const now = new Date().toISOString(),
      operations = JSON.stringify({
        quote: priced.quote,
        requestDigest: fingerprint,
        sales: { origin: 'Online booking', review: true },
        customerRequest: {
          ...(venueDetails?{venueDetails}:{}),
          receivedAt: now,
          answers: input.answers || {},
          fields: bookingQuestions(c.resources, [c.p.id]),
          consent: c.settings.requireConsent
            ? {
                acceptedAt: now,
                text: c.settings.consentText,
                url: c.settings.privacyUrl,
              }
            : undefined,
          message: notes,
          requestType: c.p.settings!.bookingMode,
          approvalRequired: true,
        },
      });
    const writes = [
      discountGuard(c.bid, id, priced.quote.discountId),
      db
        .prepare(
          "INSERT INTO events(id,business_id,title,client,email,phone,date,time,venue,source,status,items,total,deposit,notes,follow_up,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'Online booking request','lead',?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
        )
        .bind(
          id,
          c.bid,
          title,
          client,
          contact,
          phone,
          input.date,
          input.time,
          venue,
          JSON.stringify([priced.item]),
          priced.quote.total,
          priced.quote.depositDefault,
          notes ? 'Client message: ' + notes : '',
          '',
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO event_operations(event_id,business_id,data) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND business_id=? AND created_at=? AND email=?) ON CONFLICT(event_id) DO NOTHING',
        )
        .bind(id, c.bid, operations, id, c.bid, now, contact),
    ];
    await db.batch(writes);
    const saved = await db
      .prepare(
        'SELECT data FROM event_operations WHERE event_id=? AND business_id=?',
      )
      .bind(id, c.bid)
      .first<{ data: string }>();
    if (!saved || JSON.parse(saved.data).requestDigest !== fingerprint)
      return reply(
        {
          error:
            'This request could not be saved. Refresh the page and try again.',
        },
        409,
      );
    return receipt();
  } catch (e) {
    return failure(e);
  }
}
