# Desktop build — all-in-one Windows `.exe` (Electron)

PartEngine ships as a single Windows application that **bundles everything**: an embedded
PostgreSQL, the NestJS API, and the Next.js UI — no Docker, no separate Node, no manual DB
setup. The user double-clicks one installer (or the portable `.exe`) and gets the full
enterprise stack locally, with an optional switch to expose it on the LAN for multiple users.

> This **reuses the existing server stack unchanged** — Electron is an orchestrator, not a
> rewrite. The web/Docker deployment ([ARCHITECTURE.md](ARCHITECTURE.md)) remains fully valid;
> desktop is an additional packaging.

## How it works at launch

```
 Electron main process (apps/desktop)
   1. Loading splash window
   2. DatabaseManager → start embedded PostgreSQL in %APPDATA%/PartEngine/pgdata
        • first run: initialise cluster + create DB
        • every run: prisma migrate deploy + 001_search.sql (FTS/trgm)
   3. ServiceManager → spawn API (Electron's bundled Node, ELECTRON_RUN_AS_NODE)
        • wait for GET /api/health  (db: true)
      → spawn Next.js standalone server
        • wait for HTTP 200
   4. BrowserWindow loads http://127.0.0.1:<webPort>  ·  loading splash closes
   5. Tray icon (keeps the all-in-one server alive in the background; shows LAN URL)
```

Ports default to a high, app-specific range (`47532` pg / `47600` api / `47700` web) to avoid
clashes. Data lives in `%APPDATA%/PartEngine` and is **never** touched by updates.

## Local-only vs LAN (multi-user)

- Default: services bind to `127.0.0.1` — only this PC.
- Set `PARTENGINE_LAN=true` to bind `0.0.0.0`; the tray then shows the address
  (`http://<lan-ip>:47700`) other machines on the network can open. This is how the
  "all-in-one server" serves multiple users from one host while keeping the full RBAC/audit model.

## Modules (`apps/desktop/src`)

| File | Responsibility |
|------|----------------|
| `config.ts` | ports, paths, packaged-vs-dev resource resolution, `DATABASE_URL` |
| `database.ts` | embedded PostgreSQL lifecycle + migrations |
| `services.ts` | spawn API/Next as child Node procs; health-gated startup |
| `main.ts` | app lifecycle, loading/main windows, tray, single-instance, graceful shutdown |
| `preload.ts` | locked-down bridge (contextIsolation on, nodeIntegration off) |

## Building the installer

```bash
# 1) Build the workspace bundles
pnpm --filter @partengine/core build
pnpm --filter @partengine/api build
pnpm --filter @partengine/api prisma:generate
pnpm --filter @partengine/web build          # next standalone output

# 2) Stage the bundles for packaging
node apps/desktop/scripts/prepare-bundles.mjs

# 3) Package (run on Windows, or with Wine, for a real .exe)
pnpm --filter @partengine/desktop dist:win            # NSIS installer + portable .exe
#  → apps/desktop/release/PartEngine-0.1.0-x64.exe
```

The embedded PostgreSQL binaries are pulled in by the `embedded-postgres` dependency's
platform package (`@embedded-postgres/windows-x64`) and bundled automatically.

> **Note:** producing the final Windows `.exe` must run on Windows (or Linux+Wine) with
> network access to fetch Electron + Postgres binaries. The scaffold here is complete and the
> launcher logic is implemented; the binary itself is built in CI on a Windows runner
> (see the suggested GitHub Actions job in the repo issues/PR).

## Updates on desktop

The Docker `infra/update.sh` path ([UPDATES.md](UPDATES.md)) is for the server deployment.
The desktop build instead uses **`electron-updater`** against GitHub Releases (NSIS
differential updates). The existing version-comparison logic in `@partengine/core` and the
in-app update banner remain the trigger; only the *apply* step differs (electron-updater
download+install vs. docker pull). Wiring `electron-updater` is the next step for the desktop
target. The `tools/update-verifier` `.exe` continues to verify the version-detection logic.

## Security notes (desktop specifics)

- `contextIsolation: true`, `nodeIntegration: false`; the renderer gets only the tiny
  `window.partengine` bridge from `preload.ts`.
- External links open in the system browser (`setWindowOpenHandler` denies in-app navigation).
- Single-instance lock prevents two processes opening the same Postgres data dir.
- Local Postgres listens on `127.0.0.1` only (even in LAN mode the DB stays local; only API/UI
  are exposed), with app-generated credentials.
