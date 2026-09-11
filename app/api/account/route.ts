import { getChatGPTUser } from '@/app/chatgpt-auth';
import { businessFor } from '@/db/store';
import { accountState, accountAction } from '@/db/user-account';
const reply = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: 'Sign in first.' }, 401);
  const business = await businessFor(user.userId);
  if (!business) return reply({ error: 'Create your business first.' }, 404);
  return reply(await accountState(String(business.id), user));
}
export async function POST(req: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return reply({ error: 'Sign in first.' }, 401);
    if (
      (req.headers.get('origin') &&
        req.headers.get('origin') !== new URL(req.url).origin) ||
      req.headers.get('sec-fetch-site') === 'cross-site'
    )
      return reply({ error: 'Invalid request source.' }, 403);
    const raw = await req.text();
    if (raw.length > 32000) return reply({ error: 'Form is too large.' }, 413);
    const body = JSON.parse(raw),
      business = await businessFor(user.userId);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return reply({ error: 'Invalid account form.' }, 400);
    if (!business) return reply({ error: 'Create your business first.' }, 404);
    await accountAction(String(business.id), user, body);
    return reply(await accountState(String(business.id), user));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unable to save.';
    return reply(
      {
        error:
          message === 'CONFLICT'
            ? 'Your account changed in another window. Reload it before saving.'
            : /D1_|SQLITE|Database unavailable/.test(message)
              ? 'Account settings are temporarily unavailable.'
              : message,
      },
      message === 'CONFLICT' ? 409 : 400,
    );
  }
}
