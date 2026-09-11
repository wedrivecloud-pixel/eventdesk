type LogLevel = 'info' | 'warn' | 'error';
/** Small metadata allowlist; never log request bodies, queries, cookies or secrets. */
export function log(level: LogLevel, event: string, metadata: {
  requestId?: string; method?: string; path?: string; status?: number;
  durationMs?: number; code?: string; attempt?: number;
} = {}) {
  console[level](JSON.stringify({ time: new Date().toISOString(), level, event, ...metadata }));
}
