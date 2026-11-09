import { Inject, Injectable } from '@nestjs/common';
import { addDays, CLOCK, todayInSaoPaulo, type Clock } from '../../common/clock';
import { LOAN_DAYS, MAX_OPEN_LOANS } from '../loans/loan-rules';
import { LoansRepository } from '../loans/loans.repository';
import type { TenantCtx } from '../tenancy/tenant.guard';
import { EquipmentRepository } from './equipment.repository';
import { codificarCursor, type CatalogoDto, type CursorEquipamento } from './equipment.schemas';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly equipment: EquipmentRepository,
    private readonly loans: LoansRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async catalogo(ctx: TenantCtx, limit: number, cursor?: CursorEquipamento): Promise<CatalogoDto> {
    const hoje = todayInSaoPaulo(this.clock.now());
    const linhas = await this.equipment.listar(ctx.tenantId, ctx.userId, limit, cursor);
    const temMais = linhas.length > limit;
    const items = temMais ? linhas.slice(0, limit) : linhas;
    const ultimo = items[items.length - 1];
    const [openLoans, overdue] = await Promise.all([
      this.loans.contarAbertos(ctx.tenantId, ctx.userId),
      this.loans.temAtraso(ctx.tenantId, ctx.userId, hoje),
    ]);
    return {
      items,
      nextCursor: temMais && ultimo ? codificarCursor({ p: ultimo.patrimonio, i: ultimo.id }) : null,
      viewer: {
        openLoans,
        maxLoans: MAX_OPEN_LOANS,
        overdue,
        today: hoje,
        proposedDueAt: addDays(hoje, LOAN_DAYS),
      },
    };
  }
}
