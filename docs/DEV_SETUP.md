# Local Development Environment

Runs the full stack on your machine: Frappe v15 + LMS in Docker, portals via Vite dev servers. **$0 AWS cost, fully isolated from staging/prod.**

## Prerequisites
- Docker Desktop
- Node 20+
- (optional, for prod-fork parity) SSH access to the prod EC2

`lms.localhost` resolves to 127.0.0.1 automatically on macOS/modern browsers; if `curl http://lms.localhost:8000` fails, add `127.0.0.1 lms.localhost` to `/etc/hosts`.

## 1. Backend (one-time)

```bash
docker compose -f dev/docker-compose.yml up -d
./scripts/dev-setup.sh          # bench init + site lms.localhost + LMS app (~10-15 min first run)
```

What it does: `frappe/bench` container + MariaDB **10.11** (pinned to match prod RDS) + two Redis containers; bench in a named volume (`bench-data`), this repo mounted read-only at `/repo`; creates site **lms.localhost** (login `Administrator` / `admin`), installs stock `frappe/lms`, sets `developer_mode`, then overlays `backend/frappe-lms/lms/lms/*.py`.

Start the dev server:

```bash
docker compose -f dev/docker-compose.yml exec frappe bash -lc 'cd /workspace/frappe-bench && bench start'
```

Backend is now at **http://lms.localhost:8000**.

### Prod-fork parity (recommended, needs prod SSH)
The stock LMS app may diverge from the Afritutors fork running in prod. Swap in the exact prod code (prod is only read):

```bash
./scripts/dev-fetch-lms.sh          # host comes from scripts/env/prod.env, or pass ubuntu@<ip>
```

## 2. Sync backend changes

After editing anything in `backend/frappe-lms/lms/lms/`:

```bash
./scripts/dev-sync-backend.sh       # copies *.py into the bench, clears __pycache__; dev server auto-reloads
```

## 3. Seed content

```bash
docker compose -f dev/docker-compose.yml exec frappe bash -lc \
  'cd /workspace/frappe-bench && SEED_SITE=lms.localhost SEED_BENCH_PATH=/workspace/frappe-bench \
   ./env/bin/python /repo/scripts/seed_delta_spmu.py'
```

### Refresh from staging

To replace local data with a developer-safe staging clone:

```bash
aws login
./scripts/sync-staging-to-dev.sh
```

The command uses EC2 Instance Connect, backs up the current local site under
`dev/backups/`, mirrors staging's LMS app, restores the staging database and
public files, anonymizes identities and payment references, disables outbound
integrations, clears sessions, and resets the local login to
`Administrator` / `admin`. Private staging files and `site_config.json` are
never downloaded.

## 4. Frontends

`.env.local` files (already created, gitignored) point the Vite proxy at the local backend:

```
VITE_DEV_API_TARGET=http://lms.localhost:8000
```

```bash
cd frontend/student-portal && npm install && npm run dev   # http://localhost:5173
cd frontend/admin-portal  && npm install && npm run dev    # http://localhost:5174
```

The existing vite proxy (`/api`, `/files`, `/method` → target, `cookieDomainRewrite: localhost`) makes everything same-origin — no code changes, sessions/CSRF just work.

Marketing site: `npm run dev` at the repo root (port 5175 if 5173 is taken). To point its CTAs at local portals, create `.env.local` at the root with `VITE_STUDENT_PORTAL_URL=http://localhost:5173` etc. (see `src/config.js`).

## Day-to-day

| Action | Command |
|---|---|
| Start everything | `docker compose -f dev/docker-compose.yml up -d` then `bench start` (above) |
| Stop | `docker compose -f dev/docker-compose.yml stop` |
| Backend shell | `docker compose -f dev/docker-compose.yml exec frappe bash` |
| Bench console | `... exec frappe bash -lc 'cd /workspace/frappe-bench && bench --site lms.localhost console'` |
| Reset site DB | `... bench --site lms.localhost reinstall` (destroys local data only) |
| Nuke everything | `docker compose -f dev/docker-compose.yml down -v` (removes volumes) |

## Notes / gotchas
- **Payments**: no provider sandboxes configured locally by default; payment flows will fail at initiation unless you `bench --site lms.localhost set-config` the telebirr/Chapa/EthSwitch sandbox keys (see `scripts/configure-payments.sh` for key names).
- **Vimeo**: set `VITE_VIMEO_ACCESS_TOKEN` in admin portal `.env.local` and `VITE_USE_VIMEO_PROXY=false` for direct-token local testing, or `bench set-config vimeo_access_token` to use the proxy path.
- **Email**: no SMTP configured locally — Frappe queues emails silently. Enable the Mailpit block in `dev/docker-compose.yml` if you need to inspect outgoing mail.
- The email CRM tab in the admin portal is inert locally (`VITE_EMAIL_API_URL` unset) — same as staging.
