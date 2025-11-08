import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailSuppression } from './entities/email-suppression.entity';
import { EmailOutbox } from './entities/email-outbox.entity';
import { EmailService } from '../services/email.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailSuppression, EmailOutbox])],
  providers: [EmailService],
  exports: [EmailService, TypeOrmModule],
})
export class EmailModule {}
