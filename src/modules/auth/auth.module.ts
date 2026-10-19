import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { MeController } from './me.controller';

@Module({
  controllers: [MeController],
  providers: [JwtVerifierService, AuthGuard],
  exports: [JwtVerifierService, AuthGuard],
})
export class AuthModule {}
