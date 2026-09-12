import { expect, type BrowserContext } from '@playwright/test';

// Reuse a real, verified QA login across fresh browser contexts in this worker.
// Keep cookies in memory; production sign-in limits remain enabled and unchanged.
const sessions = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();

export async function signInOwner(context: BrowserContext, base: string) {
  if (process.env.QA_AUTH_MODE === 'sites-local') {
    if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
      throw Error('Local beta QA requires loopback.');
    await context.addCookies([{ name: '__sites_local_auth', value: '1', url: base }]);
    return;
  }
  if (process.env.SEED_SYNTHETIC_DATA !== 'true') throw Error('Synthetic QA required.');
  const saved = sessions.get(base);
  if (saved) {
    await context.addCookies(saved);
    return;
  }
  const response = await context.request.post(base + '/api/auth/sign-in/email', {
    headers: { Origin: base },
    data: { email: 'qa-other@example.test', password: process.env.SEED_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const cookies = await context.cookies(base);
  expect(cookies.length).toBeGreaterThan(0);
  sessions.set(base, cookies);
}
