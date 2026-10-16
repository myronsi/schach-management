# Schach-Management (SC Laufenburg)

Admin interface for the SC Laufenburg chess club website. Board members (`admin` / `chairman`)
use it to maintain events, news, club history, teams, tournament results, media galleries,
quick facts ("Schnellinfo"), documents, user accounts and membership applications.

## Structure

| Path | Contents |
| --- | --- |
| `src/` | React + TypeScript single-page admin app (Vite, Tailwind, shadcn/ui, TanStack Query) |
| `src/lib/` | Shared helpers: API base URL (`api.ts`), auth/token handling, API error handling, edit locks, date helpers |
| `server/` | PHP API (`*.php`) that the app and the public website talk to, plus cron scripts |
| `.github/workflows/` | CI: type check, lint, build and SFTP deployment |

## Local development

Requirements: Node.js 20 and npm.

```bash
npm ci
cp .env.example .env.local   # optional, see below
npm run dev                  # http://localhost:8080
```

The API base URL is configured at build time:

- `VITE_API_BASE` – base URL of the PHP API without trailing slash (default `https://sc-laufenburg.de/api`).
  Point it at a local or staging API for development – avoid working against production.
- `VITE_SITE_BASE` – optional public site root for uploaded files/photos (default: `VITE_API_BASE` without `/api`).

## Checks

```bash
npm run typecheck   # tsc -p tsconfig.app.json --noEmit
npm run lint        # eslint
npm run build       # production build into dist/
```

CI runs all three on every push to `main`; the build must pass them before anything is deployed.

## Deployment

Pushing to `main` triggers `.github/workflows/node.js.yml`, which builds the app and uploads via SFTP:

- `dist/*` → `/management/` (admin SPA)
- `server/*` → `/api/` (PHP API)

SFTP credentials come from the repository secrets `SFTP_SERVER`, `SFTP_USERNAME` and `SFTP_PASSWORD`.

## Server configuration

The PHP API expects two config files next to the scripts on the host (i.e. in `/api/`).
**Never commit them** – they are git-ignored and must be created on the server manually.

`server/.env` – content database and mail settings:

```ini
host2=...
user2=...
password2=...
database2=...
port2=3306
from_email=...
cron_key=...
```

`server/.env.auth` – user database, JWT and CORS settings:

```ini
host=...
user=...
password=...
database=...
port=3306
jwt_secret=...          ; long random secret
allowed_origins=...     ; comma-separated list of allowed origins
```

## Cron jobs

`server/queue_tomorrow_events.php` and `server/send_emails.php` send the event reminder e-mails.
They must be run either via the PHP CLI (e.g. `php /path/to/api/send_emails.php`) or over HTTP with
the cron key: `https://<host>/api/send_emails.php?key=<cron_key>`. Requests without a valid key are rejected.
