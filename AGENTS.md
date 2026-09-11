# EventDesk development guidance

## Public launch architecture

The user selected this target stack on September 8, 2026 and explicitly asked
that it guide ongoing development:

- **Neon / PostgreSQL** for the database.
- **Better Auth** for EventDesk account registration, sessions, and sign-in.
  Public users should not need a ChatGPT account.
- **Wasabi** for package images, attachments, and other uploaded files.
- **Railway** for application hosting.

On September 10, 2026 the user explicitly authorized migration and deployment.
This isolated branch now targets GitHub, Railway, Neon, Better Auth, Wasabi and
Cloudflare DNS/SSL. See docs/readiness.md for verified status and release gates.
The original Sites/Workers/D1/R2 beta remains in the separate source workspace.

When developing features:

- Account for the target stack in design decisions. Keep database, storage,
  authentication, and hosting-specific code behind clear server-side boundaries
  where practical, without speculative rewrites.
- Preserve the separate live beta. Do not publish this migration through Sites.
- PostgreSQL and Better Auth have local synthetic QA coverage. Do not assume
  Railway, real Wasabi storage, email delivery or Cloudflare is connected.
- Preserve isolation between independent businesses in records, permissions,
  and file access through future changes and the migration.
- Plan migration of existing records, uploaded files, and user access. Verify
  the new setup and a rollback path before switching the live address.

Only use synthetic fixtures for destructive tests; production seed is forbidden.
