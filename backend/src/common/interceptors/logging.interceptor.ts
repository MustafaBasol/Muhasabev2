import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url, headers } = request;
    const userAgent = this.normalizeHeader(headers['user-agent']);
    const authHeader = this.normalizeHeader(headers.authorization);

    const startTime = Date.now();

    this.logger.log(
      `📨 ${method} ${url} - ${userAgent ?? 'unknown'} - Auth: ${authHeader ? '[PROVIDED]' : '[NONE]'}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `📤 ${method} ${url} - ${response.statusCode} - ${duration}ms`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `❌ ${method} ${url} - ERROR - ${duration}ms - ${message}`,
          );
        },
      }),
    );
  }

  private normalizeHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value[0];
    }
    return undefined;
  }
}
