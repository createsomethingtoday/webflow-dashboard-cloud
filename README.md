# Webflow Dashboard Cloud

Standalone Next.js 15 Webflow Cloud port of the creator dashboard.

## Scope

This repo contains the MVP dashboard migration for Webflow Cloud:

- magic-link login and verification
- protected dashboard and marketplace routes
- asset list, detail, edit, and archive flows
- primary, secondary, and carousel image uploads through R2
- profile and API key management
- submission tracking and marketplace analytics
- template intake submission flow

The canonical parity inventory lives in `specs/webflow-dashboard-cloud-parity-matrix.md`.

## Repo layout

- app routes and API handlers live at the repo root under `app/`
- shared framework-neutral logic lives in `packages/webflow-dashboard-core`
- Webflow Cloud configuration lives in `webflow.json` and `wrangler.json`

## Runtime bindings

Webflow Cloud should provision these bindings from `wrangler.json`:

- `DB`: D1 database for app-owned persistence
- `SESSIONS`: KV namespace for login rate limits and session storage
- `UPLOADS`: R2 bucket for dashboard uploads

## Environment variables

Required:

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `CSRF_TRUSTED_ORIGINS`

Recommended:

- `ADMIN_EMAILS`
- `ENVIRONMENT`
- `DEBUG_LOGS`
- `DEBUG_AIRTABLE`

Framework/runtime path values:

- `BASE_URL`
- `ASSETS_PREFIX`
- `NEXT_PUBLIC_BASE_PATH`

For local development, copy values from `.env.example`. In Webflow Cloud, set the secrets in the environment UI instead of committing them.

## Commands

```bash
npm install
npm run check:core
npm run test:core
npm run dev
npm run check
npm run build
npm run preview
```

## Route surface

UI routes:

- `/login`
- `/verify`
- `/dashboard`
- `/assets/[id]`
- `/marketplace`
- `/submit`

API routes:

- `POST /api/auth/login`
- `POST /api/auth/verify-token`
- `POST /api/auth/logout`
- `GET /api/auth/check-session`
- `GET /api/assets`
- `GET /api/assets/check-name`
- `GET|PUT /api/assets/[id]`
- `DELETE /api/assets/[id]/archive`
- `POST /api/upload`
- `GET /api/uploads/[...path]`
- `GET|PUT /api/profile`
- `GET /api/keys`
- `POST /api/keys/generate`
- `DELETE /api/keys/revoke`
- `GET /api/analytics/leaderboard`
- `GET /api/analytics/categories`
- `GET /api/submission-status`
- `GET|POST /api/cron/cleanup`
- template intake routes under `/api/intake/*`

## Security model

- session cookie: `session_token`
- cookie policy: `HttpOnly`, `Secure`, `SameSite=None`
- default session TTL: 2 hours
- verification token TTL: 60 minutes
- middleware protects dashboard routes and rejects invalid origins on mutating API requests
- iframe headers explicitly allow Webflow-hosted embedding and remove `X-Frame-Options`

## Deployment notes

- Keep business logic in standard route handlers and server components. Do not add `runtime = "edge"` to app routes.
- Webflow Cloud injects the mount path. The app reads `BASE_URL`, `ASSETS_PREFIX`, and `window.__NEXT_DATA__.assetPrefix` to resolve paths correctly under a prefixed deployment.
- The cron cleanup route exists, but scheduling should stay external until Webflow Cloud scheduling is confirmed for this app.
