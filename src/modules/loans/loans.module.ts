import { Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { LoansController } from './loans.controller';
import { LoansRepository } from './loans.repository';
import { LoansService } from './loans.service';

@Module({
  controllers: [LoansController],
  providers: [LoansRepository, LoansService, AuditRepository],
  exports: [LoansRepository],
})
export class LoansModule {}
