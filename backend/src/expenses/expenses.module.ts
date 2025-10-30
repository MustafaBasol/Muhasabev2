import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { Expense } from './entities/expense.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Expense]), CommonModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
