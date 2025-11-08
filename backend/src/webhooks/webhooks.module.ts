import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SesSnsController } from './ses-sns.controller';
import { EmailSuppression } from '../email/entities/email-suppression.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailSuppression])],
  controllers: [SesSnsController],
})
export class WebhooksModule {}
