# Security, backup & DR strategy

## Authentication
- **JWT** with short-lived access tokens (15m) + rotating refresh tokens (7d) stored
  **hashed** (`RefreshToken.tokenHash`) so a DB leak can't replay them. Refresh rotation +
  reuse-detection revokes the whole family on theft.
- Passwords hashed with **argon2id** (memory-hard). No plaintext, ever.
- Login attempts rate-limited and audited.

## Authorization — RBAC
- Global roles: `SUPER_ADMIN · WAREHOUSE_MANAGER · TECHNICIAN · PURCHASING · VIEWER`.
- Enforced by a NestJS `RolesGuard` (`@Roles()` decorator) on every mutating route.
- **Per-warehouse** access (`WarehouseAccess.canWrite`) layered on top, so a technician can be
  read-only in one warehouse and read-write in another. Checked in the service layer where the
  warehouse is known.

## Audit log
- A global interceptor records `user · timestamp · operation · oldValue · newValue · reason ·
  ip · userAgent` for every create/update/delete (and login/export).
- Append-only: no UPDATE/DELETE on `AuditLog`; enforced by a DB role lacking those grants and a
  trigger. Partitioned monthly for retention/perf. **Nothing is ever lost.**

## API protection
- **Rate limiting** (`@nestjs/throttler`, Redis store) per IP + per user.
- Validation with `class-validator` DTOs + a global `ValidationPipe` (whitelist + forbid
  unknown props) → no mass-assignment.
- Helmet headers, strict CORS allow-list, body-size limits.
- Large files via **S3 presigned URLs** — the API never proxies blobs.

## Data protection
- Sensitive columns (supplier credentials, API keys) encrypted at rest with envelope
  encryption (app-level AES-256-GCM, key in KMS/secret manager). TLS in transit.
- Secrets only via env/secret manager — never committed (`.env` is git-ignored; `.env.example`
  ships placeholders).
- PII minimised; export operations audited.

## Backup & disaster recovery
- **Postgres:** nightly `pg_dump` + continuous WAL archiving (PITR) to object storage;
  retention 30 daily / 12 monthly. Restores tested quarterly.
- **Object storage:** versioned bucket + cross-region replication for datasheets/images.
- **RPO ≤ 5 min** (WAL), **RTO ≤ 1 h**. Backups encrypted; restore runbook in ops docs.

## Supply-chain & CI
- `pnpm` lockfile + `pnpm audit` in CI; Dependabot; SAST on PRs.
- Containers run as non-root, minimal base images, pinned digests.
```
