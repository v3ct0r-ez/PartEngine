import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Maps Prisma errors to sensible HTTP status codes so the API returns 4xx for
 * client-caused conditions (duplicate email/code, missing row, FK violation)
 * instead of a generic 500. Without this, e.g. createUser with a duplicate
 * email or any update of a non-existent id surfaces as an opaque 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Errore database';

    switch (exception.code) {
      case 'P2002': {
        // Unique constraint failed.
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[] | string | undefined) ?? [];
        const fields = Array.isArray(target) ? target.join(', ') : String(target);
        message = fields ? `Valore già esistente: ${fields}` : 'Valore duplicato';
        break;
      }
      case 'P2025': // Record not found (update/delete on missing row).
        status = HttpStatus.NOT_FOUND;
        message = 'Risorsa non trovata';
        break;
      case 'P2003': // Foreign-key constraint failed.
        status = HttpStatus.BAD_REQUEST;
        message = 'Riferimento non valido';
        break;
      case 'P2000': // Value too long for column.
        status = HttpStatus.BAD_REQUEST;
        message = 'Valore troppo lungo';
        break;
      default:
        this.logger.error(`Unmapped Prisma error ${exception.code}: ${exception.message}`);
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      // Let Nest's default handler format unknown DB failures.
      throw new HttpException(message, status);
    }
    res.status(status).json({ statusCode: status, message });
  }
}
