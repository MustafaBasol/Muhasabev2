import { Module } from '@nestjs/common';
import { SubprocessorsController } from './subprocessors.controller';

@Module({
  controllers: [SubprocessorsController],
})
export class SubprocessorsModule {}