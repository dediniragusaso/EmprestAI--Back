import { Module } from '@nestjs/common';
import { LoansRepository } from './loans.repository';

@Module({ providers: [LoansRepository], exports: [LoansRepository] })
export class LoansModule {}
