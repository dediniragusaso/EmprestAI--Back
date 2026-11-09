import { Injectable } from '@nestjs/common';
import { dateOnly } from '../../common/clock';
import { PrismaService } from '../prisma/prisma.service';

// Repository (ADR-001 §3): so ele fala com o Prisma. Toda consulta leva `tenantId` do contexto.
@Injectable()
export class LoansRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Quantos emprestimos abertos a pessoa tem no tenant. */
  contarAbertos(tenantId: string, userId: string): Promise<number> {
    return this.prisma.loan.count({ where: { tenantId, userId, returnedAt: null } });
  }

  /** A pessoa tem emprestimo aberto com `dueAt` anterior a `hoje` (YYYY-MM-DD)? `dueAt` = hoje nao e atraso. */
  async temAtraso(tenantId: string, userId: string, hoje: string): Promise<boolean> {
    const n = await this.prisma.loan.count({
      where: { tenantId, userId, returnedAt: null, dueAt: { lt: dateOnly(hoje) } },
    });
    return n > 0;
  }
}
