import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Tenant, TenantGuard, type TenantCtx } from '../tenancy/tenant.guard';
import { EquipmentService } from './equipment.service';
import { lerQuery } from './equipment.schemas';

// GET /v1/equipment: catalogo do tenant da pessoa logada (spec 003, R1 e R2).
@Controller('equipment')
@UseGuards(AuthGuard, TenantGuard)
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Get()
  listar(@Tenant() ctx: TenantCtx, @Query() query: unknown) {
    const { limit, cursor } = lerQuery(query);
    return this.service.catalogo(ctx, limit, cursor);
  }
}
