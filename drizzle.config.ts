import { defineConfig } from 'drizzle-kit';
export default defineConfig({out:'./migrations/postgres',schema:'./db/schema.ts',dialect:'postgresql'});
