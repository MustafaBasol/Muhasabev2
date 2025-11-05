import { PartialType } from '@nestjs/mapped-types';
import { CreateQuoteDto } from './create-quote.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { QuoteStatus } from '../entities/quote.entity';

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}
