import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Maps Prisma errors to sensible HTTP status codes so the API returns 4xx for
 * client-caused conditions (duplicate code, missing row, FK violation, bad/
 * out-of-range data) instead of an opaque 500. Catches *all* Prisma error
 * classes — a numeric overflow surfaces as an Unknown/Validation error, not a
 * KnownRequestError, and would otherwise escape as a 500.
 *
 * Important: this never re-throws. Throwing inside a filter leaves the request
 * without a response (it hangs), which on the desktop build looks like a frozen
 * app. We always write a JSON response.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const { status, message } = this.map(exception);
    if (status >= 500) {
      this.logger.error((exception as Error)?.message ?? String(exception));
    }
    res.status(status).json({ statusCode: status, message });
  }

  private map(exception: unknown): { status: number; message: string } {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const target = (exception.meta?.target as string[] | string | undefined) ?? [];
          const fields = Array.isArray(target) ? target.join(', ') : String(target);
          return { status: HttpStatus.CONFLICT, message: fields ? `Valore già esistente: ${fields}` : 'Valore duplicato' };
        }
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Risorsa non trovata' };
        case 'P2003':
          return { status: HttpStatus.BAD_REQUEST, message: 'Riferimento non valido' };
        case 'P2000':
          return { status: HttpStatus.BAD_REQUEST, message: 'Valore troppo lungo per il campo' };
        default:
          this.logger.error(`Unmapped Prisma error ${exception.code}: ${exception.message}`);
          return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Errore database' };
      }
    }
    // Validation / unknown-request errors are almost always caused by bad input
    // reaching the query (e.g. a numeric overflow on a Decimal column).
    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Dati non validi per il salvataggio' };
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return { status: HttpStatus.SERVICE_UNAVAILABLE, message: 'Database non disponibile' };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Errore interno' };
  }
}
