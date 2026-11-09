import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Tenant, TenantGuard, type TenantCtx } from '../tenancy/tenant.guard';
import { lerCorpoAbrir } from './loans.schemas';
import { LoansService } from './loans.service';

// POST /v1/loans: a pessoa logada pede um equipamento para si (spec 003, R6). Nao ha "outra pessoa".
@Controller('loans')
@UseGuards(AuthGuard, TenantGuard)
export class LoansController {
  constructor(private readonly service: LoansService) {}

  @Post()
  abrir(@Tenant() ctx: TenantCtx, @Body() body: unknown) {
    const { equipmentId } = lerCorpoAbrir(body);
    return this.service.abrir(ctx, equipmentId);
  }
}
