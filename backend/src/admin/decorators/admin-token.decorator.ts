import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { resolveAdminHeaders } from '../utils/admin-token.util';

export const AdminToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const { adminToken } = resolveAdminHeaders(request.headers);

    if (adminToken !== 'admin-access-granted') {
      throw new UnauthorizedException('Invalid or missing admin token');
    }

    return adminToken;
  },
);
