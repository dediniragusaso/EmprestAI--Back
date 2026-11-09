// Apoio dos testes de API da spec 003 (T6): app Nest sobre o Postgres descartavel do Testcontainers.
// Sem @nestjs/testing (dependencia nao aprovada): a raiz de teste e montada a mao, com modulos
// globais que trocam o verificador de JWT, o PrismaService e o relogio. Nunca fala com o Supabase
// remoto nem le .env: a URL do banco e a do conteiner.
import { Global, Injectable, Module, UnauthorizedException, type INestApplication, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Equipment, EquipmentCategory, EquipmentStatus, Loan, PrismaClient, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { subirBanco, type BancoDeTeste } from '../../prisma/dados-iniciais/banco-teste';
import { lerItens } from '../../prisma/dados-iniciais/dados';
import { gravarEquipamentos } from '../../prisma/dados-iniciais/equipamentos';
import { configureApp } from '../bootstrap';
import { CLOCK, dateOnly, type Clock } from '../common/clock';
import { JwtVerifierService, type AuthUser } from '../modules/auth/jwt-verifier.service';
import { PrismaService } from '../modules/prisma/prisma.service';

/** Relogio controlavel: o teste congela o "agora" do servidor. */
export class ClockFalso implements Clock {
  constructor(public atual: Date) {}
  now(): Date {
    return this.atual;
  }
  definir(iso: string): void {
    this.atual = new Date(iso);
  }
}

/** Verificador falso: aceita so tokens `teste:<id>:<email>` (o verificador real tem o seu spec). */
@Injectable()
class VerificadorFalso {
  async verify(token: string): Promise<AuthUser> {
    const [prefixo, id, email] = token.split(':');
    if (prefixo !== 'teste' || !id) throw new UnauthorizedException('Token invalido.');
    return { id, email: email ?? null };
  }
}

export interface Usuario {
  id: string;
  email: string;
  token: string;
}

export interface OpcoesApp {
  modulos?: Type[];
  controllers?: Type[];
  /** Instante inicial do relogio do servidor (ISO). Padrao: 2026-11-09T15:00:00Z. */
  agora?: string;
}

export class AppDeTeste {
  constructor(
    readonly app: INestApplication,
    readonly banco: BancoDeTeste,
    readonly clock: ClockFalso,
    readonly tenantA: string,
    readonly tenantB: string,
  ) {}

  get prisma(): PrismaClient {
    return this.banco.prisma;
  }

  http() {
    return request(this.app.getHttpServer());
  }

  /** Cria usuario (espelho de `public.users`) e, se `tenant` for dado, o vinculo no tenant. */
  async criarUsuario(tenant: 'A' | 'B' | null = 'A', role: Role = 'COLABORADOR'): Promise<Usuario> {
    const id = randomUUID();
    const email = `u-${id.slice(0, 8)}@teste.local`;
    await this.prisma.user.create({ data: { id, email, name: email } });
    if (tenant) {
      await this.prisma.membership.create({
        data: { userId: id, tenantId: tenant === 'A' ? this.tenantA : this.tenantB, role },
      });
    }
    return { id, email, token: `teste:${id}:${email}` };
  }

  async criarEquipamento(
    tenant: 'A' | 'B',
    dados: { name?: string; patrimonio?: string; status?: EquipmentStatus; category?: EquipmentCategory } = {},
  ): Promise<Equipment> {
    const n = randomUUID().slice(0, 8);
    return this.prisma.equipment.create({
      data: {
        tenantId: tenant === 'A' ? this.tenantA : this.tenantB,
        name: dados.name ?? `Equipamento ${n}`,
        category: dados.category ?? 'ACESSORIO',
        patrimonio: dados.patrimonio ?? `X-${n}`,
        status: dados.status ?? 'DISPONIVEL',
      },
    });
  }

  /** Emprestimo aberto semeado por SQL (atraso e limite so se reproduzem assim). `dueAt` em YYYY-MM-DD. */
  async semearEmprestimo(dados: {
    userId: string;
    equipmentId: string;
    tenantId?: string;
    dueAt: string;
    openedAt?: string;
  }): Promise<Loan> {
    const loan = await this.prisma.loan.create({
      data: {
        tenantId: dados.tenantId ?? this.tenantA,
        equipmentId: dados.equipmentId,
        userId: dados.userId,
        openedAt: dados.openedAt ? new Date(dados.openedAt) : this.clock.now(),
        dueAt: dateOnly(dados.dueAt),
      },
    });
    await this.prisma.equipment.update({ where: { id: dados.equipmentId }, data: { status: 'EMPRESTADO' } });
    return loan;
  }

  async parar(): Promise<void> {
    await this.app.close();
    await this.banco.parar();
  }
}

export async function subirAppDeTeste(opcoes: OpcoesApp = {}): Promise<AppDeTeste> {
  const banco = await subirBanco();
  const clock = new ClockFalso(new Date(opcoes.agora ?? '2026-11-09T15:00:00.000Z'));

  // Dados base: dois tenants; o A com os 12 equipamentos reais da spec 002; o B com dois itens.
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  await banco.prisma.tenant.create({ data: { id: tenantA, slug: 'suporte_ti', name: 'Suporte TI' } });
  await banco.prisma.tenant.create({ data: { id: tenantB, slug: 'outro_tenant', name: 'Outro tenant' } });
  await gravarEquipamentos(banco.prisma, tenantA, lerItens(), 'http://localhost:54321');
  for (const n of [1, 2]) {
    await banco.prisma.equipment.create({
      data: { tenantId: tenantB, name: `Item do outro tenant ${n}`, category: 'CABO', patrimonio: `TB-000${n}` },
    });
  }

  const prismaApp = new PrismaService(banco.uri);

  @Global()
  @Module({
    providers: [{ provide: JwtVerifierService, useClass: VerificadorFalso }],
    exports: [JwtVerifierService],
  })
  class AuthFalsoModule {}

  @Global()
  @Module({
    providers: [
      { provide: PrismaService, useValue: prismaApp },
      { provide: CLOCK, useValue: clock },
    ],
    exports: [PrismaService, CLOCK],
  })
  class InfraTesteModule {}

  @Module({
    imports: [AuthFalsoModule, InfraTesteModule, ...(opcoes.modulos ?? [])],
    controllers: opcoes.controllers ?? [],
  })
  class RaizDeTeste {}

  const app = await NestFactory.create(RaizDeTeste, { logger: false });
  configureApp(app);
  await app.init();
  return new AppDeTeste(app, banco, clock, tenantA, tenantB);
}
