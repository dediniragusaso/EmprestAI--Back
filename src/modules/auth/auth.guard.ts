import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtVerifierService, type AuthUser } from './jwt-verifier.service';

export type AuthedRequest = Request & { user: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Token ausente.');
    req.user = await this.jwt.verify(token);
    return true;
  }
}
