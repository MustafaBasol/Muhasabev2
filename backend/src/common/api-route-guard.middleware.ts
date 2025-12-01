import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Placeholder middleware to guard API routes.
 * Currently acts as a pass-through but keeps the hook in place
 * for future allow/deny logic and keeps app.module imports valid.
 */
@Injectable()
export class ApiRouteGuardMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    next();
  }
}
