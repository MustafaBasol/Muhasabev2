import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const AdminToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const adminToken = request.headers['admin-token'];
    
    if (adminToken !== 'admin-access-granted') {
      throw new UnauthorizedException('Invalid or missing admin token');
    }
    
    return adminToken;
  },
);
