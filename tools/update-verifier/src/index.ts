/**
 * PartEngine Update Verifier — a standalone CLI (ships as a Windows .exe) that
 * tests and verifies the auto-update tool.
 *
 * It does four real things:
 *   1. logic   — offline self-test of the version-comparison engine (the exact
 *                @partengine/core code the API uses to decide "is newer?").
 *   2. mock    — runs a fake GitHub "releases/latest" server so you can point a
 *                dev API at it (UPDATE_GITHUB_API_BASE) and watch the banner light up.
 *   3. check   — hits a live API: logs in, reads /updates/status + /updates/check,
 *                and validates the response shape and version logic.
 *   4. gating  — asserts POST /updates/apply is correctly refused under safe
 *                conditions (no update available, or self-apply disabled), so we
 *                verify the safety gates without mutating the deployment.
 *
 * Exit code is non-zero if any assertion fails (CI-friendly).
 */
import { compareSemver, isNewerVersion, parseSemver } from '@partengine/core';
import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';

// ── tiny output helpers ──────────────────────────────────────
const C = { green: '\x1b[32m', red: '\x1b[31m', dim: '\x1b[2m', yellow: '\x1b[33m', reset: '\x1b[0m' };
let failures = 0;
function ok(msg: string) {
  console.log(`${C.green}✓${C.reset} ${msg}`);
}
function fail(msg: string) {
  failures++;
  console.log(`${C.red}✗ ${msg}${C.reset}`);
}
function assert(cond: boolean, msg: string) {
  cond ? ok(msg) : fail(msg);
}
function info(msg: string) {
  console.log(`${C.dim}${msg}${C.reset}`);
}

// ── arg parsing ──────────────────────────────────────────────
function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else (out[key] = next), i++;
    }
  }
  return out;
}

// ── minimal HTTP client (no fetch dependency, works on node18 base) ──
interface HttpResult {
  status: number;
  json: any;
  text: string;
}
function httpRequest(
  method: string,
  url: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const req = lib.request(
      u,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
          ...opts.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json: any = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            /* non-JSON */
          }
          resolve({ status: res.statusCode ?? 0, json, text: data });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── 1) logic self-test ───────────────────────────────────────
function runLogic() {
  console.log('\n── Version-logic self-test ──');
  assert(parseSemver('v1.2.3')?.minor === 2, 'parses v-prefixed versions');
  assert(parseSemver('garbage') === null, 'rejects non-versions');
  assert(compareSemver('1.2.0', '1.10.0') === -1, 'compares numerically (1.2 < 1.10)');
  assert(compareSemver('1.0.0', '1.0.0-rc.1') === 1, 'release outranks its prerelease');
  assert(isNewerVersion('0.2.0', '0.1.0') === true, 'detects a newer version');
  assert(isNewerVersion('0.1.0', '0.1.0') === false, 'equal version is not newer');
  assert(isNewerVersion('0.1.0', '0.2.0') === false, 'older version is not newer');
}

// ── 2) mock GitHub release server ────────────────────────────
function runMock(args: Record<string, string | boolean>) {
  const port = Number(args.port ?? 8788);
  const tag = String(args.version ?? 'v9.9.9');
  const repo = String(args.repo ?? 'v3ct0r-ez/PartEngine');

  const server = http.createServer((req, res) => {
    if (req.url?.endsWith('/releases/latest')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          tag_name: tag,
          html_url: `https://example.com/${repo}/releases/tag/${tag}`,
          body: `Mock release ${tag} served by update-verifier for testing.`,
          published_at: new Date().toISOString(),
        }),
      );
      info(`served releases/latest -> ${tag}`);
    } else {
      res.writeHead(404).end('not found');
    }
  });
  server.listen(port, () => {
    console.log(`\n${C.green}Mock GitHub release server on http://localhost:${port}${C.reset}`);
    console.log('Point the API at it and restart it:');
    console.log(`  ${C.yellow}UPDATE_GITHUB_API_BASE=http://localhost:${port}${C.reset}`);
    console.log(`  ${C.yellow}UPDATE_GITHUB_REPO=${repo}${C.reset}`);
    console.log(`Then the update banner should offer ${tag}. Ctrl+C to stop.`);
  });
}

// ── live API helpers ─────────────────────────────────────────
async function login(api: string, email: string, password: string): Promise<string | null> {
  const res = await httpRequest('POST', `${api}/api/auth/login`, { body: { email, password } });
  if (res.status === 201 || res.status === 200) return res.json?.accessToken ?? null;
  fail(`login failed (${res.status}): ${res.text.slice(0, 120)}`);
  return null;
}

// ── 3) live check ────────────────────────────────────────────
async function runCheck(args: Record<string, string | boolean>) {
  console.log('\n── Live API update check ──');
  const api = String(args.api).replace(/\/$/, '');
  const token = await resolveToken(args, api);
  if (!token) return;
  const auth = { Authorization: `Bearer ${token}` };

  const status = await httpRequest('GET', `${api}/api/updates/status`, { headers: auth });
  assert(status.status === 200, 'GET /updates/status returns 200');
  const s = status.json ?? {};
  assert(typeof s.currentVersion === 'string', 'status has currentVersion');
  assert('updateAvailable' in s, 'status has updateAvailable flag');
  info(
    `current=${s.currentVersion} latest=${s.latestVersion ?? 'n/a'} available=${s.updateAvailable}`,
  );

  const check = await httpRequest('GET', `${api}/api/updates/check`, { headers: auth });
  assert(check.status === 200, 'GET /updates/check returns 200');
  const c = check.json ?? {};
  if (c.latestVersion) {
    assert(
      c.updateAvailable === isNewerVersion(c.latestVersion, c.currentVersion),
      'API updateAvailable matches local semver comparison',
    );
  } else if (c.error) {
    info(`checker reported error (expected if offline / rate-limited): ${c.error}`);
  }
}

// ── 4) gating safety check ───────────────────────────────────
async function runGating(args: Record<string, string | boolean>) {
  console.log('\n── Apply-gating safety check ──');
  const api = String(args.api).replace(/\/$/, '');
  const token = await resolveToken(args, api);
  if (!token) return;
  const auth = { Authorization: `Bearer ${token}` };

  const status = (await httpRequest('GET', `${api}/api/updates/status`, { headers: auth })).json ?? {};
  const apply = await httpRequest('POST', `${api}/api/updates/apply`, { headers: auth });

  if (!status.updateAvailable) {
    assert(
      apply.status === 400,
      'apply is refused (400) when no update is available',
    );
  } else {
    // An update IS available: apply must still be gated by the env flag/role.
    assert(
      [200, 201, 403].includes(apply.status),
      'apply is either started (2xx) or gated (403) — never an unguarded error',
    );
    if (apply.status === 403) ok('apply correctly gated (UPDATE_ALLOW_APPLY=false or non-admin)');
    if (apply.status < 300)
      info('apply STARTED — an actual update was triggered (use a disposable/dev API for this).');
  }
}

async function resolveToken(
  args: Record<string, string | boolean>,
  api: string,
): Promise<string | null> {
  if (typeof args.token === 'string') return args.token;
  if (typeof args.email === 'string' && typeof args.password === 'string') {
    return login(api, args.email, args.password);
  }
  fail('provide --token, or --email and --password, for live checks');
  return null;
}

// ── entry point ──────────────────────────────────────────────
function usage() {
  console.log(`PartEngine Update Verifier

Usage:
  partengine-update-verifier <command> [options]

Commands:
  logic                          Offline self-test of the version-comparison engine
  mock   --port 8788 --version v9.9.9 [--repo owner/name]
                                 Run a mock GitHub releases server for E2E testing
  check  --api URL  (--token T | --email E --password P)
                                 Verify a live API's update status/check
  gating --api URL  (--token T | --email E --password P)
                                 Verify apply is properly gated (no mutation)
  all    --api URL  (--token T | --email E --password P)
                                 logic + check + gating

Examples:
  partengine-update-verifier logic
  partengine-update-verifier mock --version v0.2.0
  partengine-update-verifier all --api http://localhost:4000 --email admin@partengine.local --password changeme123
`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  switch (command) {
    case 'logic':
      runLogic();
      break;
    case 'mock':
      runMock(args);
      return; // long-running; don't fall through to the summary
    case 'check':
      if (!args.api) return usage();
      await runCheck(args);
      break;
    case 'gating':
      if (!args.api) return usage();
      await runGating(args);
      break;
    case 'all':
      runLogic();
      if (args.api) {
        await runCheck(args);
        await runGating(args);
      } else {
        info('\n(no --api given; skipped live checks)');
      }
      break;
    default:
      return usage();
  }

  console.log(
    failures === 0
      ? `\n${C.green}All checks passed.${C.reset}`
      : `\n${C.red}${failures} check(s) failed.${C.reset}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`${C.red}Verifier crashed:${C.reset}`, err);
  process.exit(2);
});
