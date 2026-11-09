import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

// RFC 9457 (ADR-001 §4)
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException && status < 500 ? exception.message : 'Erro interno.';
    // Extensão RFC 9457: `code` estável para a tela decidir sem ler texto (spec 003, R7).
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const code =
      status < 500 && typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string'
        ? body.code
        : undefined;
    res
      .status(status)
      .type('application/problem+json')
      .json({ type: 'about:blank', title: HttpStatus[status] ?? 'Error', status, detail, ...(code ? { code } : {}) });
  }
}
