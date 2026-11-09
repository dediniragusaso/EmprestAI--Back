import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/** Único tenant da v1 (ADR-001 §6, seed). O tenant nunca vem do body, da query nem de header. */
export const TENANT_SLUG = 'suporte_ti';

export type TenantRequest = AuthedRequest & { tenantId: string; role: Role };

export interface TenantCtx {
  tenantId: string;
  userId: string;
  role: Role;
}

// Spec 003, R1 e Q1: o JWT do Supabase não traz tenant; o servidor o resolve pelo vínculo em
// `memberships`. Roda depois do AuthGuard. Sem vínculo: 403.
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    if (!req.user) throw new UnauthorizedException('Token ausente.');
    const membership = await this.prisma.membership.findFirst({
      where: { userId: req.user.id, tenant: { slug: TENANT_SLUG } },
      select: { tenantId: true, role: true },
    });
    if (!membership) throw new ForbiddenException('Sem vinculo com o tenant.');
    req.tenantId = membership.tenantId;
    req.role = membership.role;
    return true;
  }
}

/** Parâmetro de rota: `@Tenant() ctx: TenantCtx` (tenant, pessoa e papel, todos do servidor). */
export const Tenant = createParamDecorator((_data: unknown, context: ExecutionContext): TenantCtx => {
  const req = context.switchToHttp().getRequest<TenantRequest>();
  return { tenantId: req.tenantId, userId: req.user.id, role: req.role };
});
