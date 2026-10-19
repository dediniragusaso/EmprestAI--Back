import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { RootController } from './modules/root/root.controller';

@Module({
  imports: [AuthModule],
  controllers: [RootController, HealthController],
})
export class AppModule {}
