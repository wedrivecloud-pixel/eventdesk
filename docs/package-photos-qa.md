# Photos during package creation

Date: 2026-09-11. Status: published to the Sites beta as version 36; the matching Railway-target changes remain local and have not been pushed to GitHub.

Sites publication succeeded at 2026-09-11T23:22:16Z. Source commit: `5f724958062931dc217ef9321a799e6394548bf9`. Existing audience preserved. Live URL: https://eventdesk-business-crm.atagirl.chatgpt.site .

## Change

New packages accept up to ten PNG, JPEG or WebP photos (5 MB each) before saving. The editor previews the selection, supports removal and choosing the primary image, and preserves the selection when switching tabs. No package or image is written merely by choosing a file. Closing the unsaved form discards its temporary previews.

Save creates the package, then uploads the selected photos in order using the existing authenticated, tenant-scoped image endpoint. The form stays busy until uploads finish. The save response now includes `savedPackageId`, so duplicate titles cannot cause photos to attach to the wrong package. Existing consumers of the CRM snapshot remain compatible.

After an upload failure, the saved package ID and remaining files stay in the open form. Retrying updates that package; uploads already acknowledged as successful are removed from the queue. Details and images use separate requests, so this is not a database/object-storage transaction. Closing or reloading a partially completed form loses its still-unsaved files; the error explains that package details were saved. Existing-package image editing continues to save immediately.

The same application changes are present in the separate Sites beta checkout. Storage adapters, tenant checks and database schemas were not changed.

## Validation

- TypeScript checks passed in both checkouts.
- Sites beta production build passed using the project's normal build command. The Sites build wrapper failed to resolve npm on Windows; the direct build succeeded. Existing bundle-size and duplicate-CSS warnings remain.
- Railway-target production build passed, including standalone packaging, verification of 54 referenced client assets, and compression of 67 static assets. Existing middleware-deprecation and bundle-size warnings remain.
- Three Playwright regression tests passed against the local Sites beta using temporary QA records, with created packages/photos cleaned up.
- Mobile visual check at 390 × 844 passed.
- Tests cover selecting multiple images before saving, changing primary image, removal, tab navigation, invalid type, oversized images, maximum count, duplicate package titles, persistence after save, existing-package uploads, a simulated partial upload failure and retry, blocking dismissal during upload, and discarding unsaved selections.

Regression suite: `tests/browser/package-photos.spec.ts`. It uses the normal synthetic Better Auth account in CI. For the separate local Sites beta, set `QA_BASE_URL=http://localhost:3000` and `QA_AUTH_MODE=sites-local`; this mode rejects non-loopback hosts.

The new browser tests have not yet run on Railway/Wasabi or GitHub Actions. No live credentials, access policies, production data or deployment settings were changed.
