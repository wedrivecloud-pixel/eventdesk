import { rawDb } from './raw';
import { digest } from './public-booking';

// Use the existing durable quota table, not an isolate-local counter, for
// anonymous customer searches. All packages in a business share these caps.
export async function publicPlacesLimit(req: Request, bid: string) {
  const now = Math.floor(Date.now() / 1000),
    ip = req.headers.get('x-eventdesk-client-ip') || 'unknown';
  const limits = [
    { scope: ip, window: 900, max: 60 },
    { scope: 'business', window: 86400, max: 1000 },
  ];
  const db = rawDb();
  await db
    .prepare(
      'DELETE FROM booking_rate_limits WHERE key IN (SELECT key FROM booking_rate_limits WHERE expires_at<? LIMIT 100)',
    )
    .bind(now)
    .run();
  for (const l of limits) {
    const window = Math.floor(now / l.window),
      key = await digest(
        JSON.stringify(['places', bid, l.scope, window, l.window]),
      );
    const row = await db
      .prepare(
        'INSERT INTO booking_rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=booking_rate_limits.hits+1 WHERE booking_rate_limits.hits<? RETURNING hits',
      )
      .bind(key, (window + 1) * l.window, l.max)
      .first();
    if (!row) throw Error('PLACES_LIMIT');
  }
}
