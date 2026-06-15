# PartEngine Update Verifier (`.exe`)

A standalone CLI — distributable as a **Windows `.exe`** — that tests and verifies the
PartEngine [auto-update tool](../../docs/UPDATES.md). No Node install required on the target
machine; the runtime and the `@partengine/core` version logic are bundled in.

## Commands

| Command | What it verifies | Needs |
|---------|------------------|-------|
| `logic` | The version-comparison engine the API uses to decide "is newer?" | nothing (offline) |
| `mock`  | Serves a fake GitHub `releases/latest` so a dev API detects a "new" version end-to-end | nothing |
| `check` | A live API's `/updates/status` + `/updates/check` (shape + version logic) | running API |
| `gating`| That `POST /updates/apply` is correctly refused under safe conditions (no mutation) | running API |
| `all`   | `logic` + (`check` + `gating` if `--api` given) | optional API |

Exit code is non-zero if any assertion fails (CI-friendly).

## Examples

```powershell
# Offline self-test of the update decision logic
partengine-update-verifier.exe logic

# End-to-end: run a mock release server, then point a DEV api at it
partengine-update-verifier.exe mock --version v0.2.0
#   set on the API:  UPDATE_GITHUB_API_BASE=http://localhost:8788
#   the update banner should now offer v0.2.0

# Verify a live API (status/check + that apply is properly gated)
partengine-update-verifier.exe all ^
  --api http://localhost:4000 ^
  --email admin@partengine.local --password changeme123
#   or use --token <jwt> instead of email/password
```

> `gating` never triggers a real update unless an update is available **and** the API has
> `UPDATE_ALLOW_APPLY=true`. Point it at a disposable/dev API if you want to exercise apply.

## Building the `.exe`

```bash
pnpm --filter @partengine/update-verifier build:exe        # → dist/partengine-update-verifier.exe (win-x64)
pnpm --filter @partengine/update-verifier build:exe:all    # win + linux + macos
```

The build bundles `src/index.ts` (inlining `@partengine/core`) with esbuild, then packages it
with [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg). The `dist/` output is git-ignored.
