# Site Kill Switch

A build-time gate that swaps the live app for a generic "we'll be back" maintenance page. Controlled by a single Vercel environment variable per project. Used when leverage is needed against an unpaid client.

## Env var

| Variable | Value to kill | Effect |
|---|---|---|
| `VITE_SITE_DISABLED` | `true` | Render maintenance page; no routing, no API calls, no auth checks |
| `VITE_SITE_DISABLED` | unset / anything else | Site renders normally |

Default-to-live is intentional so `npm run dev` keeps working without local config. The client cannot read or change Vercel env vars, so the leverage holds either way.

## How to flip it

For each Vercel project:

1. **Project Settings → Environment Variables**
2. Add `VITE_SITE_DISABLED` = `true` for Production
3. **Deployments → … → Redeploy** the latest deployment (env var changes don't auto-rebuild)

To bring the site back: delete the var (or set it to `false`) and redeploy.

## Projects to update

| Site | Repo / Vercel project | Component file |
|---|---|---|
| `deltaspmu.com` (marketing) | **Separate GitHub + Vercel account** — push from that remote | `src/components/SiteGate.jsx` |
| `learn.deltaspmu.com` (student portal) | Main repo, Vercel project for student portal | `frontend/student-portal/src/components/SiteGate.tsx` |
| `admin.deltaspmu.com` (admin portal) | Main repo, Vercel project for admin portal | `frontend/admin-portal/src/components/SiteGate.tsx` |

The marketing site lives in this repo's root (`src/`) but deploys via a different GitHub + Vercel account. Push the marketing site changes from whichever git remote points at that account.

## Easter egg

Konami code (↑ ↑ ↓ ↓ ← → ← → B A) anywhere on any of the three sites — live or killed — pops a hidden gold-on-green panel. Click to dismiss. Survives the kill switch because it's mounted alongside it.

## Why a build-time gate (and not a runtime feature flag)

- Zero new infrastructure
- Works offline / without the backend
- No way for the client to override at runtime — they'd need access to Vercel
- Bundle still ships, but the maintenance page is the only thing rendered, so no API calls leak
