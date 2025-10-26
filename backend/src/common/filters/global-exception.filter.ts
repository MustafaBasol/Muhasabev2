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
    let errorInfo: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      
      // HttpException response'u object ise tüm alanları koru
      if (typeof errorResponse === 'object' && errorResponse !== null) {
        errorInfo = {
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          error: exception.name,
          ...(errorResponse as object), // Tüm custom alanları dahil et (message, relatedExpenses, count vs.)
        };
        message = (errorResponse as any).message || 'Error';
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
    this.logger.error(
      `HTTP ${status} ${error} - ${message}`,
      {
        ...errorInfo,
        stack: exception instanceof Error ? exception.stack : undefined,
        body: request.method !== 'GET' ? request.body : undefined,
        query: request.query,
        params: request.params,
        headers: {
          'user-agent': request.headers['user-agent'],
          'authorization': request.headers.authorization ? '[HIDDEN]' : undefined,
          'content-type': request.headers['content-type'],
        },
      },
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorInfo);
  }
}