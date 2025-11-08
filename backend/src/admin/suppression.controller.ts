import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailSuppression } from '../email/entities/email-suppression.entity';

@Controller('admin/suppression')
export class SuppressionAdminController {
  constructor(
    @InjectRepository(EmailSuppression)
    private readonly suppressionRepo: Repository<EmailSuppression>,
  ) {}

  @Get()
  async list(@Query('q') q?: string, @Query('limit') limit = '50') {
    const take = Math.min(parseInt(String(limit)) || 50, 200);
    const qb = this.suppressionRepo
      .createQueryBuilder('s')
      .orderBy('s.createdAt', 'DESC')
      .take(take);
    if (q) {
      qb.where('s.email ILIKE :q', { q: `%${q}%` });
    }
    return qb.getMany();
  }

  @Delete(':email')
  async remove(@Param('email') email: string) {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return { success: false };
    await this.suppressionRepo.delete({ email: normalized });
    return { success: true };
  }
}
