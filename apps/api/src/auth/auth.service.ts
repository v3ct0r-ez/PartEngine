import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user.id, user.email, user.role);
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken = await this.jwt.signAsync(payload, {
      // Fallback matches JwtStrategy so signing & verifying stay consistent even
      // if JWT_ACCESS_SECRET isn't set (otherwise jsonwebtoken throws
      // 'secretOrPrivateKey must have a value' and login fails with a 500).
      secret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret',
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });

    // Refresh token is opaque; only its hash is stored, so a DB leak can't replay it.
    const refresh = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.sha256(refresh), expiresAt },
    });

    return { accessToken, refreshToken: refresh, user: { id: userId, email, role } };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Rotate: revoke the old token, issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // ── First-run setup (no users yet) ───────────────────────
  async needsSetup(): Promise<boolean> {
    return (await this.prisma.user.count()) === 0;
  }

  /** Create the first administrator. Allowed ONLY when no user exists. */
  async setup(input: { email: string; fullName: string; password: string }) {
    if ((await this.prisma.user.count()) > 0) {
      throw new ForbiddenException('Setup already completed');
    }
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        role: 'SUPER_ADMIN',
        passwordHash: await argon2.hash(input.password),
      },
    });
    return this.issueTokens(user.id, user.email, user.role);
  }

  // ── User & access administration (SUPER_ADMIN) ───────────
  async createUser(input: {
    email: string;
    fullName: string;
    password: string;
    role: Role;
  }) {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        passwordHash: await argon2.hash(input.password),
      },
    });
    return this.publicUser(user);
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { email: 'asc' },
      include: { warehouseAccess: { include: { warehouse: { select: { code: true, name: true } } } } },
    });
    return users.map((u) => ({
      ...this.publicUser(u),
      access: u.warehouseAccess.map((a) => ({
        warehouseId: a.warehouseId,
        warehouse: a.warehouse.name,
        canWrite: a.canWrite,
      })),
    }));
  }

  /** Change the logged-in user's own password (verifies the current one). */
  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await argon2.verify(user.passwordHash, current))) {
      throw new UnauthorizedException('Password attuale errata');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(next) } });
    await this.revokeTokens(userId);
    return { success: true };
  }

  /** Admin reset of another user's password. */
  async adminResetPassword(userId: string, next: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(next) } });
    await this.revokeTokens(userId);
    return { success: true };
  }

  /** Enable/disable a user. Can't disable yourself or the last active admin. */
  async setActive(userId: string, isActive: boolean, actingUserId: string) {
    if (!isActive) {
      if (userId === actingUserId) throw new BadRequestException('Non puoi disattivare il tuo account');
      await this.assertNotLastAdmin(userId);
    }
    await this.prisma.user.update({ where: { id: userId }, data: { isActive } });
    if (!isActive) await this.revokeTokens(userId);
    return { success: true };
  }

  /** Change a user's role. Demoting the last active admin is blocked. */
  async setRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') await this.assertNotLastAdmin(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { role } });
    return { success: true };
  }

  private async assertNotLastAdmin(excludeUserId: string) {
    const others = await this.prisma.user.count({
      where: { role: 'SUPER_ADMIN', isActive: true, id: { not: excludeUserId } },
    });
    if (others === 0) throw new BadRequestException('Deve restare almeno un amministratore attivo');
  }

  private revokeTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Grant or update per-warehouse access for a user. */
  grantWarehouseAccess(input: { userId: string; warehouseId: string; canWrite: boolean }) {
    return this.prisma.warehouseAccess.upsert({
      where: {
        userId_warehouseId: { userId: input.userId, warehouseId: input.warehouseId },
      },
      create: input,
      update: { canWrite: input.canWrite },
    });
  }

  private publicUser(u: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    isActive: boolean;
    lastLoginAt: Date | null;
  }) {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
    };
  }
}
