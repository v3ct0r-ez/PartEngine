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

The loading window shows a live, installer-style checklist of the first-run steps
(init database → migrations → start API → start UI), driven by progress events the
main process pushes to it (src/loading-preload.ts → window.peLoading.onStatus), so
the user gets immediate feedback during the heavy first launch.
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

### Producing the `.exe` via CI (recommended)

The final installer is built by [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml)
on a `windows-latest` runner (a real Windows `.exe` can't be produced from a plain Linux box
without Wine + large binary downloads):

- **Manual run** (Actions → "Desktop Release" → *Run workflow*): builds and uploads
  `PartEngine-<version>-x64.exe` (+ `latest.yml`) as a **workflow artifact** — download it from
  the run page. No release is published.
- **Tag `vX.Y.Z`**: builds and **publishes** the installer to the matching GitHub Release;
  `electron-updater` then serves it to already-installed clients.

> The installer is currently **unsigned**, so Windows SmartScreen will warn on first run. Add a
> code-signing certificate via the `CSC_LINK`/`CSC_KEY_PASSWORD` electron-builder secrets to
> remove the warning.

## Updates on desktop (`electron-updater` — wired)

The Docker `infra/update.sh` path ([UPDATES.md](UPDATES.md)) is for the server deployment. The
desktop build uses **`electron-updater`** against GitHub Releases (NSIS differential updates).

Flow (same notify + one-click model as the rest of PartEngine):

```
 main process (apps/desktop/src/updater.ts)
   autoUpdater.autoDownload = false
   checkForUpdates() ──▶ 'update-available' ──▶ banner: "Scarica aggiornamento"
        │                                              │ download()
        ▼                                              ▼
   'download-progress' (percent) ──▶ 'update-downloaded' ──▶ banner: "Installa e riavvia"
                                                              │ quitAndInstall()
                                                              ▼
                                                         app restarts on new version
```

- State + events are bridged to the renderer over IPC (`preload.ts` → `window.partengine.updater`).
- The web `UpdateBanner` detects `window.partengine?.isDesktop` and drives the updater bridge
  on desktop, or the server-side `/updates/apply` endpoint on web — one component, both modes.
- `publish: { provider: github }` in `electron-builder.yml` is what the updater queries and what
  makes the build emit `latest.yml`. Releases must be tagged `vX.Y.Z` with the artifacts attached.
- `tools/update-verifier` continues to verify the version-detection logic.

## Troubleshooting — "nothing happens" on launch

If double-clicking the `.exe` shows no window:

1. **Check the log.** `%APPDATA%\PartEngine\logs\partengine.log` (early crashes fall back to
   `%TEMP%\PartEngine-logs\partengine.log`). The launcher now logs every startup phase and
   surfaces any error as a dialog (global `uncaughtException`/`unhandledRejection` handlers).
2. **Run from a terminal** to see stdout/stderr directly:
   `"C:\Program Files\PartEngine\PartEngine.exe"` (or the portable exe path) from `cmd`/PowerShell.
3. **A stale background instance?** PartEngine keeps running in the system tray; a second launch
   exits immediately by design (single-instance lock). Quit it from the tray or kill leftover
   `PartEngine`/`postgres` processes in Task Manager, then relaunch.
4. **First run is slower** — it initialises the Postgres cluster and runs migrations before the
   window appears; watch the splash.
5. **Slow to even show the splash (minutes)?** You're likely running the **portable** build,
   which self-extracts the whole app (~200 MB) to `%TEMP%` on *every* launch — and an unsigned
   binary gets scanned by SmartScreen/Defender each time. Use the **installer**
   (`PartEngine-Setup-<version>.exe`) instead: it unpacks once to disk, so subsequent launches
   start in seconds. Code-signing (CSC_LINK) removes the AV scan delay too.

Known root causes fixed in earlier revisions: the packaged app must include
`node_modules` (electron-updater + embedded-postgres are required at launch), and
**asar packing is disabled** (`asar: false`) — embedded-postgres spawns native
PostgreSQL binaries (`initdb`/`pg_ctl`/`postgres`) by a path relative to its own
module, which inside an asar archive resolves to a virtual path that
`child_process` can't execute (`ENOENT`). Shipping files unpacked fixes it.
Rebuild via the Desktop Release workflow to get a corrected installer.

## Database encoding (UTF-8)

The embedded cluster is initialised with `--encoding=UTF8 --no-locale` so symbols
in component units (Ω, µ, °C) store correctly — on Windows `initdb` otherwise
defaults to WIN1252 ("character … has no equivalent in encoding WIN1252"). This
applies to the **first** initialisation only; a cluster created by an older build
stays WIN1252, so delete `%APPDATA%\PartEngine\pgdata` once to re-initialise.

## First run / initial account

No default password is shipped. On first launch the database has the seeded
**catalog** (taxonomy + demo parts) but **no users**, so the app shows a
**"Create administrator"** screen (`GET /auth/status` → `needsSetup`). The user
sets their own email + password → a `SUPER_ADMIN` is created via the public
`POST /auth/setup` (allowed only while zero users exist) and they're logged in.
Afterwards it's a normal login; further users are created from **Utenti**
(admin only). Existing installs that already had the old seeded admin keep
working and skip setup.

## Data location, NAS & backups

There is no single "warehouse file": data lives in the embedded **PostgreSQL
cluster directory** (`%APPDATA%/PartEngine/pgdata`), plus **attachments**
(`…/attachments`). The **Settings** page (desktop only) lets the user choose, via
a native folder picker:

- **Database folder** — keep on a **local** disk. Hosting a live Postgres cluster
  on a network share (NAS/SMB/NFS) risks corruption (no reliable locking/fsync).
- **Attachments folder** — safe on a NAS (plain files).
- **Backup folder** — set it to a NAS path to get an automatic **cold backup on
  shutdown** (the server is stopped, so the copied cluster is consistent; the last
  `backupKeep` are retained). `pg_dump` isn't shipped with embedded-postgres, so a
  cold directory copy is used instead.

Settings persist to `%APPDATA%/PartEngine/config.json` and apply on restart.
Consumer NAS note: WD My Cloud **Home** can't run PostgreSQL/Docker, so use it as
the **backup** (and optionally attachments) target — not as the live DB host.

## Security notes (desktop specifics)

- `contextIsolation: true`, `nodeIntegration: false`; the renderer gets only the tiny
  `window.partengine` bridge from `preload.ts`.
- External links open in the system browser (`setWindowOpenHandler` denies in-app navigation).
- Single-instance lock prevents two processes opening the same Postgres data dir.
- Local Postgres listens on `127.0.0.1` only (even in LAN mode the DB stays local; only API/UI
  are exposed), with app-generated credentials.
