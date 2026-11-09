import { Module } from '@nestjs/common';
import { ClockModule } from './common/clock.module';
import { AuthModule } from './modules/auth/auth.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { HealthController } from './modules/health/health.controller';
import { LoansModule } from './modules/loans/loans.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RootController } from './modules/root/root.controller';

@Module({
  imports: [ClockModule, PrismaModule, AuthModule, LoansModule, EquipmentModule],
  controllers: [RootController, HealthController],
})
export class AppModule {}
