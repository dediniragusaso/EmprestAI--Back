import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { MeController } from './me.controller';

// Global: os módulos de domínio usam o AuthGuard sem importar este módulo, e o teste de app troca o
// verificador de JWT por um falso sem precisar de @nestjs/testing (dependência não aprovada).
@Global()
@Module({
  controllers: [MeController],
  providers: [JwtVerifierService, AuthGuard],
  exports: [JwtVerifierService, AuthGuard],
})
export class AuthModule {}
