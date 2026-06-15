import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Records an AuditLog entry for every mutating request. The body's optional
 * `_reason` field is captured ("Motivo della modifica"). Services may also call
 * AuditService.record directly with old/new diffs for fine-grained history.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (!MUTATING.has(req.method)) return next.handle();

    const entity = (req.route?.path ?? req.url).split('/').filter(Boolean)[1] ?? 'unknown';

    return next.handle().pipe(
      tap((result) => {
        const entityId = (result as { id?: string } | null)?.id ?? req.params?.id ?? 'n/a';
        void this.audit.record({
          userId: req.user?.id,
          entity,
          entityId: String(entityId),
          operation: req.method,
          newValue: this.sanitize(req.body),
          reason: req.body?._reason,
          ipAddress: req.ip,
          userAgent: req.headers?.['user-agent'],
        });
      }),
    );
  }

  private sanitize(body: Record<string, unknown> = {}) {
    const { password, _reason, ...rest } = body;
    return rest;
  }
}
