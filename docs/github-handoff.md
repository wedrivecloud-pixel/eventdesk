# GitHub and Railway setup — September 10, 2026

Private repository: https://github.com/wedrivecloud-pixel/eventdesk

The complete reviewed source snapshot is on `dev` and
`codex/public-launch-migration`. Draft PR #1 proposes promotion to `main`.
Automatic approval review blocked the initial `main` update because it could
trigger production CI/CD; do not merge without the user's approval.

The initial GitHub source commit is `64b54428af89b9798ea53767b5af1fda44f78841`,
equivalent to local source snapshot `1005ec8e448c7e7c874f5b2fa7d26e04490c8b04`.
Files were transferred through the authorized connector; legacy commit history
was not uploaded. The local migration checkout retains that history. Its `origin`
now points to GitHub and its old source remote is named `legacy`. Do not force-push
the differing histories. Future work should use a fresh clone of GitHub's `dev`.

## Hosted QA finding

- Severity: high / deployment blocker.
- Reproduction: clean Linux Node 22 runner, `npm ci` on initial source commit.
- Failure: Railway CLI 5.52.0 imports the removed default export from `tar` after
  the existing security override upgrades it to version 7.
- Fix: remove the deployment CLI from application dependencies. Install the
  official versioned Linux binary with a pinned SHA-256 in deployment jobs.
- Regression: Validate now runs clean `npm ci` and the verified CLI installation.
  Do not treat a local Windows install as proof of Linux compatibility.

## Remaining staging prerequisites

Railway project: `161c97f4-2f9e-4d52-aba0-a6fbe314f084` (EventDesk).
Staging environment: `2a4e97a2-ad20-42a5-8869-a416645e4f8a`.
Production environment: `ccc6ebfa-ae7e-4c6b-af61-e24692892d5a`.

Staging service `eventdesk-web` (`2971ba31-1399-4f8b-972a-793d3234ff28`) has been
created with Dockerfile builder, `Dockerfile` path and `/api/health/ready` probe.
The configuration changes were applied; the service is offline with no source
deployment. Production has no service. Runtime variables, scoped deployment
credentials, actual Wasabi storage, SMTP and public hostnames remain unconfigured.
The user confirmed a Wasabi account has not yet been created.

Railway's new-service UI reports that legacy Config as Code is no longer available
for new opt-ins after August 28, 2026. Do not assume `railway.json` configures this
service. The initial builder and probe were set explicitly in Railway; reconcile
timeout/restart limits and use the supported Infrastructure as Code mechanism
before enabling unattended releases. Reference:
https://docs.railway.com/infrastructure-as-code

Hosted validation of `4231608bd8f0053cbd1c51069bfc2577d4ea2c91` confirmed clean
dependency installation, pinned CLI installation, credential guard, security audit,
type checking, unit tests, migrations, restricted runtime setup and app build.
All workflow/browser tests and the Docker image build also passed in hosted run
`34556665538`. Container runtime, real Wasabi, email, backup restore and a live
Railway release remain unverified. This documentation update does not change the
tested application code or workflows.
