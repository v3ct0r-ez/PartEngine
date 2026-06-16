import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { isNewerVersion } from '@partengine/core';
import { spawn } from 'node:child_process';
import { AuditService } from '../audit/audit.service';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
  /** Set while an update is being applied (the API will restart). */
  applying: boolean;
  /** Last check error, if any (e.g. network/rate-limit). */
  error: string | null;
}

@Injectable()
export class UpdateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UpdateService.name);
  private timer?: NodeJS.Timeout;

  private readonly currentVersion = process.env.APP_VERSION ?? '0.1.0';
  private readonly repo = process.env.UPDATE_GITHUB_REPO ?? 'v3ct0r-ez/PartEngine';
  // Overridable so a test harness (tools/update-verifier) can point the checker
  // at a local mock release server for true end-to-end verification.
  private readonly apiBase = process.env.UPDATE_GITHUB_API_BASE ?? 'https://api.github.com';
  private readonly token = process.env.GITHUB_TOKEN;
  private readonly allowApply = process.env.UPDATE_ALLOW_APPLY === 'true';
  private readonly scriptPath = process.env.UPDATE_SCRIPT_PATH ?? '/app/infra/update.sh';
  private readonly intervalMin = Number(process.env.UPDATE_CHECK_INTERVAL_MIN ?? 360);

  private state: UpdateInfo = {
    currentVersion: this.currentVersion,
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
    releaseNotes: null,
    publishedAt: null,
    checkedAt: null,
    applying: false,
    error: null,
  };

  constructor(private readonly audit: AuditService) {}

  onModuleInit() {
    // Refresh in the background so the banner is ready without a manual check.
    void this.check().catch(() => undefined);
    if (this.intervalMin > 0) {
      this.timer = setInterval(
        () => void this.check().catch(() => undefined),
        this.intervalMin * 60_000,
      );
      this.timer.unref?.();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getStatus(): UpdateInfo {
    return this.state;
  }

  /** Query GitHub for the latest release and compare with the running version. */
  async check(): Promise<UpdateInfo> {
    const url = `${this.apiBase}/repos/${this.repo}/releases/latest`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'PartEngine-Updater',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
      });
      if (!res.ok) {
        // 404 = no releases published yet (or private repo without a token):
        // that's a normal "up to date" state, not an error worth alarming about.
        if (res.status === 404) {
          this.state = {
            ...this.state,
            updateAvailable: false,
            checkedAt: new Date().toISOString(),
            error: null,
          };
          return this.state;
        }
        throw new Error(`GitHub responded ${res.status}`);
      }
      const data = (await res.json()) as {
        tag_name: string;
        html_url: string;
        body: string;
        published_at: string;
      };

      this.state = {
        ...this.state,
        latestVersion: data.tag_name,
        updateAvailable: isNewerVersion(data.tag_name, this.currentVersion),
        releaseUrl: data.html_url,
        releaseNotes: data.body,
        publishedAt: data.published_at,
        checkedAt: new Date().toISOString(),
        error: null,
      };
    } catch (err) {
      this.logger.warn(`Update check failed: ${(err as Error).message}`);
      this.state = {
        ...this.state,
        checkedAt: new Date().toISOString(),
        error: (err as Error).message,
      };
    }
    return this.state;
  }

  /**
   * Trigger the update. Gated by UPDATE_ALLOW_APPLY (so a misconfigured prod
   * can't self-modify) and only callable by SUPER_ADMIN (enforced in the
   * controller). Spawns a *detached* script that backs up the DB, pulls the new
   * images, runs migrations and recreates the containers — detached so it
   * survives this API process being restarted by the update itself.
   */
  async apply(userId?: string): Promise<{ started: boolean; targetVersion: string | null }> {
    if (!this.allowApply) {
      throw new ForbiddenException(
        'Self-update is disabled. Set UPDATE_ALLOW_APPLY=true to enable it.',
      );
    }
    if (!this.state.updateAvailable) {
      throw new BadRequestException('No update available to apply.');
    }
    if (this.state.applying) {
      throw new BadRequestException('An update is already in progress.');
    }

    await this.audit.record({
      userId,
      entity: 'System',
      entityId: 'update',
      operation: 'UPDATE_APPLY',
      oldValue: { version: this.currentVersion },
      newValue: { version: this.state.latestVersion },
    });

    this.state = { ...this.state, applying: true };

    const child = spawn('sh', [this.scriptPath], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, TARGET_VERSION: this.state.latestVersion ?? '' },
    });
    child.on('error', (e) => {
      this.logger.error(`Updater failed to start: ${e.message}`);
      this.state = { ...this.state, applying: false, error: e.message };
    });
    child.unref();

    return { started: true, targetVersion: this.state.latestVersion };
  }
}
