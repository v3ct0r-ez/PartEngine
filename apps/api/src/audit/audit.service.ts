import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string;
  entity: string;
  entityId: string;
  operation: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        entity: entry.entity,
        entityId: entry.entityId,
        operation: entry.operation,
        oldValue: (entry.oldValue ?? undefined) as object | undefined,
        newValue: (entry.newValue ?? undefined) as object | undefined,
        reason: entry.reason,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }
}
