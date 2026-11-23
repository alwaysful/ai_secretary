import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';

export function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.auth.verify(bearer(ctx.switchToHttp().getRequest<Request>()))) {
      throw new UnauthorizedException({ code: 'ADMIN_REQUIRED', message: '관리자 세션 만료' });
    }
    return true;
  }
}
