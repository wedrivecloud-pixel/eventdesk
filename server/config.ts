/** Server-only configuration. Never import this module in client components. */
export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}
export function appOrigin(): string {
  const url = new URL(required('APP_URL'));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('APP_URL must be an origin without credentials or a path.');
  if (process.env.APP_ENV !== 'development' && url.protocol !== 'https:')
    throw new Error('APP_URL must use HTTPS outside development.');
  return url.origin;
}
export function databaseUrl(name = 'DATABASE_URL'): string {
  const value = required(name), url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(`${name} must use PostgreSQL.`);
  if (process.env.APP_ENV !== 'development' && url.searchParams.get('sslmode') !== 'verify-full')
    throw new Error(`${name} must verify TLS.`);
  return value;
}
export function validateRuntime() {
  if (!['development', 'staging', 'production'].includes(required('APP_ENV'))) throw new Error('Invalid APP_ENV.');
  appOrigin(); databaseUrl();
  if (required('BETTER_AUTH_SECRET').length < 32) throw new Error('BETTER_AUTH_SECRET must have at least 32 random characters.');
  for (const name of ['WASABI_ENDPOINT', 'WASABI_REGION', 'WASABI_BUCKET', 'WASABI_ACCESS_KEY_ID', 'WASABI_SECRET_ACCESS_KEY']) required(name);
  const endpoint = new URL(required('WASABI_ENDPOINT'));
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.wasabisys.com')) throw new Error('WASABI_ENDPOINT must be an HTTPS Wasabi endpoint.');
}
