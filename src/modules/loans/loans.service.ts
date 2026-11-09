import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { addDays, CLOCK, dateOnly, todayInSaoPaulo, type Clock } from '../../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantCtx } from '../tenancy/tenant.guard';
import { AuditRepository } from './audit.repository';
import { LoanRefusalException, MENSAGENS_RECUSA } from './loan-refusal.exception';
import { LOAN_DAYS, MAX_OPEN_LOANS } from './loan-rules';
import { LoansRepository } from './loans.repository';

export interface EmprestimoCriadoDto {
  id: string;
  equipmentId: string;
  equipmentName: string;
  patrimonio: string | null;
  openedAt: string;
  dueAt: string;
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loans: LoansRepository,
    private readonly audit: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Spec 003, R6 e Q12. Uma unica transacao, nesta ordem: equipamento do tenant (404) -> status (409)
   * -> atraso (409) -> limite (409) -> loan com dueAt = hoje + 14 -> status EMPRESTADO -> auditoria.
   * Qualquer falha desfaz tudo.
   */
  async abrir(ctx: TenantCtx, equipmentId: string): Promise<EmprestimoCriadoDto> {
    const agora = this.clock.now();
    const hoje = todayInSaoPaulo(agora);
    return this.prisma.$transaction(async (tx) => {
      const eq = await this.loans.buscarEquipamento(tx, ctx.tenantId, equipmentId);
      if (!eq) throw new NotFoundException('Equipamento nao encontrado.');

      if (eq.status === 'MANUTENCAO') throw new LoanRefusalException('equipment-unavailable');
      if (eq.status === 'EMPRESTADO') {
        const aberto = await this.loans.buscarEmprestimoAberto(tx, ctx.tenantId, eq.id);
        throw new LoanRefusalException(
          'equipment-already-loaned',
          aberto?.userId === ctx.userId ? MENSAGENS_RECUSA['equipment-already-yours'] : undefined,
        );
      }

      if (await this.loans.temAtraso(ctx.tenantId, ctx.userId, hoje, tx)) {
        throw new LoanRefusalException('loan-overdue');
      }
      if ((await this.loans.contarAbertos(ctx.tenantId, ctx.userId, tx)) >= MAX_OPEN_LOANS) {
        throw new LoanRefusalException('loan-limit-reached');
      }

      const loan = await this.loans.inserir(tx, {
        tenantId: ctx.tenantId,
        equipmentId: eq.id,
        userId: ctx.userId,
        openedAt: agora,
        dueAt: dateOnly(addDays(hoje, LOAN_DAYS)),
      });
      if ((await this.loans.marcarEmprestado(tx, ctx.tenantId, eq.id)) !== 1) {
        throw new LoanRefusalException('equipment-already-loaned');
      }
      await this.audit.registrar(tx, {
        tenantId: ctx.tenantId,
        actorUserId: ctx.userId,
        action: 'loan.open',
        resourceType: 'loan',
        resourceId: loan.id,
      });

      return {
        id: loan.id,
        equipmentId: eq.id,
        equipmentName: eq.name,
        patrimonio: eq.patrimonio,
        openedAt: loan.openedAt.toISOString(),
        dueAt: loan.dueAt.toISOString().slice(0, 10),
      };
    });
  }
}
