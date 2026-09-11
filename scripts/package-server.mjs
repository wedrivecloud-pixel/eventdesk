import fs from 'node:fs';
// Replace the generated entry with the hardened entry, not the framework runtime.
fs.copyFileSync('server/start.mjs','dist/standalone/server.js');
