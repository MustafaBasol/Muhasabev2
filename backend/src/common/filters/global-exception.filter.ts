import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;
    let errorInfo: Record<string, unknown>;

    const requestBody: unknown = request.body;
    const requestQuery: unknown = request.query;
    const requestParams: unknown = request.params;
    const userAgent = this.normalizeHeader(request.headers['user-agent']);
    const contentType = this.normalizeHeader(request.headers['content-type']);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      // HttpException response'u object ise tüm alanları koru
      if (this.isRecord(errorResponse)) {
        errorInfo = {
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          error: exception.name,
          ...errorResponse, // Tüm custom alanları dahil et (message, relatedExpenses, count vs.)
        };
        message = this.normalizeMessage(errorResponse.message) || 'Error';
      } else {
        message = typeof errorResponse === 'string' ? errorResponse : 'Error';
        errorInfo = {
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          message,
          error: exception.name,
        };
      }
      error = exception.name;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';
      errorInfo = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message,
        error,
      };
    }

    // Log detailed error information
    const metadata = {
      ...errorInfo,
      stack: exception instanceof Error ? exception.stack : undefined,
      body: request.method !== 'GET' ? requestBody : undefined,
      query: requestQuery,
      params: requestParams,
      headers: {
        'user-agent': userAgent,
        authorization: request.headers.authorization ? '[HIDDEN]' : undefined,
        'content-type': contentType,
      },
    };

    this.logger.error(
      `HTTP ${status} ${error} - ${message} - meta=${JSON.stringify(metadata)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorInfo);
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

  private normalizeMessage(message: unknown): string | undefined {
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    return undefined;
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
  }
}
