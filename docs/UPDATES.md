# Auto-update system

PartEngine self-updates with a **notify + one-click apply** model, sourced from
**GitHub Releases**. Chosen over fully-unattended updates because this is a stateful server
app: DB migrations and restarts are safest when an admin triggers them deliberately (with a
backup taken first), while still being a single click rather than a manual redeploy.

## Flow

```
 GitHub Releases ──(poll, cached)──▶ API UpdateService ──▶ /updates/status
        ▲                                   │                    │
        │ latest release tag                │ isNewerVersion()   ▼
        │                                   │            Web UpdateBanner (admin)
        │                                   │                    │ "Aggiorna ora"
        │                                   ▼                    ▼
        └────────────────────────  POST /updates/apply (SUPER_ADMIN, gated)
                                            │
                                   spawn detached infra/update.sh
                                            │
                  backup DB → docker compose pull → migrate → up -d
```

## Components

| Piece | Where | Responsibility |
|-------|-------|----------------|
| Version compare | `packages/core/src/version.ts` | `parseSemver` / `compareSemver` / `isNewerVersion` (tested) |
| Checker | `apps/api/src/update/update.service.ts` | polls GitHub `releases/latest`, caches, periodic refresh |
| Endpoints | `update.controller.ts` | `GET /updates/status`, `GET /updates/check`, `POST /updates/apply` |
| Apply script | `infra/update.sh` | backup → pull → migrate → recreate |
| Banner | `apps/web/components/update-banner.tsx` | shows availability + one-click apply |

## API

- `GET /api/updates/status` — cached `{ currentVersion, latestVersion, updateAvailable, releaseUrl, releaseNotes, publishedAt, applying }`. Any authenticated user (drives the banner).
- `GET /api/updates/check` — force a fresh GitHub check. `SUPER_ADMIN` / `WAREHOUSE_MANAGER`.
- `POST /api/updates/apply` — start the update. **`SUPER_ADMIN` only** and refused unless `UPDATE_ALLOW_APPLY=true`. Audited (`UPDATE_APPLY`, old/new version).

## Configuration (`.env`)

```
APP_VERSION="0.1.0"                 # running version (compared against releases)
UPDATE_GITHUB_REPO="v3ct0r-ez/PartEngine"
GITHUB_TOKEN=""                     # optional: higher rate limit / private repos
UPDATE_CHECK_INTERVAL_MIN="360"     # background poll cadence (0 = off)
UPDATE_ALLOW_APPLY="false"          # must be true to permit self-apply
UPDATE_SCRIPT_PATH="/app/infra/update.sh"
```

`APP_VERSION` should be injected at build/deploy time (e.g. the release tag) so the running
container knows what it is. Tag releases on GitHub as `vX.Y.Z`; the checker strips the `v`.

## Verifying the updater (`.exe`)

`tools/update-verifier` is a standalone CLI (ships as a Windows `.exe`) that tests this whole
mechanism — see [its README](../tools/update-verifier/README.md):

- `logic` — offline self-test of the version-comparison engine.
- `mock` — serves a fake GitHub `releases/latest` (point a dev API at it via
  `UPDATE_GITHUB_API_BASE`) to watch detection + the banner work end-to-end.
- `check` / `gating` — validate a live API's status/check and that `apply` is properly gated
  (without mutating the deployment).

Build: `pnpm --filter @partengine/update-verifier build:exe`.

## Safety properties

- **Backup-first:** the script aborts the update if `pg_dump` fails.
- **Migrate before swap:** migrations run in a one-shot container; if they fail, services are
  *not* recreated and the previous version keeps serving (restore from the dump if needed).
- **Double-gated apply:** role (`SUPER_ADMIN`) *and* env flag (`UPDATE_ALLOW_APPLY`) — a
  compromised lower-privilege account or a misconfigured prod can't self-modify the deployment.
- **Detached executor:** the script runs detached so it survives the API container restart it
  triggers.
- **Audited:** every apply writes an `AuditLog` entry with the from/to versions.

## Air-gapped / non-GitHub deployments

Swap the source by changing `UpdateService.check()` to read a self-hosted JSON manifest URL
(version + notes). The rest of the pipeline (compare → banner → gated apply → script) is
unchanged. Tracked as a follow-up; see also the registry-tag (Watchtower) alternative.
