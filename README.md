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

API integration tests (MariaDB + PHP in throwaway containers, requires Docker):

```bash
sh tests/api/run.sh 8.0
```

CI (`.github/workflows/node.js.yml`) runs the checks and the API tests (PHP 8.0 and 8.3) on every pull
request and every push to `main`; nothing is deployed unless all of them pass.

## Deployment

A push to `main` runs CI and then the `deploy` job (GitHub environment `production`, which can be given
required reviewers in the repository settings). It uploads via SFTP, API first:

- `server/*` → `/api/` (PHP API)
- `dist/*` → `/management/` (admin SPA)

SFTP credentials come from the repository secrets `SFTP_SERVER`, `SFTP_USERNAME` and `SFTP_PASSWORD`.
The upload only adds/overwrites files; files removed from the repository stay on the server until
deleted by hand.

## Server configuration

The PHP API reads two config files. **Never commit them** – they are git-ignored and must be created
on the server manually. They are looked up in this order:

1. the directory named by the `SCHACH_CONFIG_DIR` environment variable (e.g. `SetEnv` in the host config),
2. `schach-config/` next to the web root (the parent of `/api/`'s parent) – **recommended**, because it is
   outside the publicly served tree,
3. `/api/` itself (legacy location; only safe while the `/api/.htaccess` denies dotfiles, see
   `server/.htaccess.example`).

To migrate, copy `.env` and `.env.auth` into the new directory, check that the site still works, then
delete them from `/api/`.

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
the cron key, preferably as header so it does not end up in access logs:
`curl -H "X-Cron-Key: <cron_key>" https://<host>/api/send_emails.php`
(`?key=<cron_key>` still works). Requests without a valid key are rejected. Overlapping runs are skipped,
failed mails are retried up to 3 times, and mails older than 24 hours are no longer sent.

## Sessions

Tokens are valid for 8 days and are renewed by the admin app while it is open, but a session never
lasts longer than 30 days after the login. Changing or resetting a password immediately invalidates
all tokens of that user (use this to sign a user out everywhere). Logging out discards the token in
the browser only.

## Membership applications

Only the chairman can see applications. The list shows names and status; bank details and signatures
are loaded per application. Applications can be deleted from the detail view and should be deleted
once they are no longer needed (data minimisation).
