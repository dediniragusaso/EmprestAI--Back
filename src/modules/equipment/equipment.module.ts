import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { EquipmentController } from './equipment.controller';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [LoansModule],
  controllers: [EquipmentController],
  providers: [EquipmentService, EquipmentRepository],
})
export class EquipmentModule {}
