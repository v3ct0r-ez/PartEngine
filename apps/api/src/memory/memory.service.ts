import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_CAP = 12; // keep at most N recent items per (user, kind)

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Preferences ──────────────────────────────────────────
  async getPreferences(userId: string) {
    const pref = await this.prisma.userPreference.findUnique({ where: { userId } });
    return pref ?? { userId, theme: 'system', language: 'it', uiState: {} };
  }

  async updatePreferences(
    userId: string,
    input: { theme?: string; language?: string; uiState?: Record<string, unknown> },
  ) {
    const current = await this.prisma.userPreference.findUnique({ where: { userId } });
    // Merge uiState rather than replace, so one screen's prefs don't clobber another's.
    const uiState = {
      ...((current?.uiState as Record<string, unknown>) ?? {}),
      ...(input.uiState ?? {}),
    };
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: input.theme ?? 'system',
        language: input.language ?? 'it',
        uiState: uiState as Prisma.InputJsonValue,
      },
      update: { theme: input.theme, language: input.language, uiState: uiState as Prisma.InputJsonValue },
    });
  }

  // ── Saved views ──────────────────────────────────────────
  listViews(userId: string, scope?: string) {
    return this.prisma.savedView.findMany({
      where: { userId, ...(scope ? { scope } : {}) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createView(
    userId: string,
    input: { name: string; scope: string; config?: unknown; isDefault?: boolean },
  ) {
    if (input.isDefault) await this.clearDefault(userId, input.scope);
    return this.prisma.savedView.create({
      data: {
        userId,
        name: input.name,
        scope: input.scope,
        isDefault: input.isDefault ?? false,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updateView(
    userId: string,
    id: string,
    input: { name?: string; config?: unknown; isDefault?: boolean },
  ) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException('Vista non trovata');
    if (view.userId !== userId) throw new ForbiddenException();
    if (input.isDefault) await this.clearDefault(userId, view.scope);
    return this.prisma.savedView.update({
      where: { id },
      data: {
        name: input.name,
        isDefault: input.isDefault,
        config: input.config === undefined ? undefined : (input.config as Prisma.InputJsonValue),
      },
    });
  }

  async deleteView(userId: string, id: string) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException('Vista non trovata');
    if (view.userId !== userId) throw new ForbiddenException();
    await this.prisma.savedView.delete({ where: { id } });
    return { deleted: true };
  }

  private clearDefault(userId: string, scope: string) {
    return this.prisma.savedView.updateMany({
      where: { userId, scope, isDefault: true },
      data: { isDefault: false },
    });
  }

  // ── Recent items ─────────────────────────────────────────
  listRecent(userId: string, kind?: string, limit = RECENT_CAP) {
    return this.prisma.recentItem.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
  }

  /** Record a recent search/component/…; dedupes and keeps only the latest N. */
  async recordRecent(userId: string, input: { kind: string; refId?: string; label: string }) {
    await this.prisma.$transaction(async (tx) => {
      // Drop a prior identical entry so it bubbles to the top with a fresh time.
      await tx.recentItem.deleteMany({
        where: {
          userId,
          kind: input.kind,
          ...(input.refId ? { refId: input.refId } : { label: input.label }),
        },
      });
      await tx.recentItem.create({
        data: { userId, kind: input.kind, refId: input.refId, label: input.label },
      });
      // Trim to the cap.
      const stale = await tx.recentItem.findMany({
        where: { userId, kind: input.kind },
        orderBy: { createdAt: 'desc' },
        skip: RECENT_CAP,
        select: { id: true },
      });
      if (stale.length) {
        await tx.recentItem.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
      }
    });
    return { ok: true };
  }
}
