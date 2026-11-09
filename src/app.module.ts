import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RootController } from './modules/root/root.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RootController, HealthController],
})
export class AppModule {}
