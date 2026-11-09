import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { subirBanco, type BancoDeTeste } from '../../../prisma/dados-iniciais/banco-teste';
import type { PrismaService } from '../prisma/prisma.service';
import { TenantGuard, type TenantRequest } from './tenant.guard';

jest.setTimeout(240_000);

function contexto(req: Partial<TenantRequest>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

// Fatia 003, T5. CA-14 (403 sem vínculo) e CA-13 (tenant resolvido pelo vínculo, não pelo cliente).
describe('TenantGuard', () => {
  let banco: BancoDeTeste;
  let guard: TenantGuard;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const comVinculo = randomUUID();
  const semVinculo = randomUUID();
  const soOutroTenant = randomUUID();

  beforeAll(async () => {
    banco = await subirBanco();
    const { prisma } = banco;
    await prisma.tenant.create({ data: { id: tenantA, slug: 'suporte_ti', name: 'Suporte TI' } });
    await prisma.tenant.create({ data: { id: tenantB, slug: 'outro', name: 'Outro' } });
    for (const [id, email] of [
      [comVinculo, 'a@x.com'],
      [semVinculo, 'b@x.com'],
      [soOutroTenant, 'c@x.com'],
    ]) {
      await prisma.user.create({ data: { id, email, name: email } });
    }
    await prisma.membership.create({ data: { userId: comVinculo, tenantId: tenantA, role: 'OPERACOES' } });
    await prisma.membership.create({ data: { userId: soOutroTenant, tenantId: tenantB, role: 'COLABORADOR' } });
    guard = new TenantGuard(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await banco?.parar();
  });

  it('CA-13: resolve tenant e papel pelo vínculo, ignorando tenant enviado pelo cliente', async () => {
    const req = {
      user: { id: comVinculo, email: 'a@x.com' },
      headers: { 'x-tenant-id': tenantB },
      body: { tenantId: tenantB },
    } as unknown as TenantRequest;
    await expect(guard.canActivate(contexto(req))).resolves.toBe(true);
    expect(req.tenantId).toBe(tenantA);
    expect(req.role).toBe('OPERACOES');
  });

  it('CA-14: sem vínculo nenhum devolve 403', async () => {
    const req = { user: { id: semVinculo, email: 'b@x.com' } } as TenantRequest;
    await expect(guard.canActivate(contexto(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('CA-14: vínculo só com outro tenant (não suporte_ti) devolve 403', async () => {
    const req = { user: { id: soOutroTenant, email: 'c@x.com' } } as TenantRequest;
    await expect(guard.canActivate(contexto(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('CA-14: sem usuário autenticado no request devolve 401', async () => {
    await expect(guard.canActivate(contexto({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
