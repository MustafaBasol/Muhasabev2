import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';
import type { CurrentUser } from '../common/decorators/user.decorator';

@ApiTags('bank-accounts')
@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Banka hesabı oluştur' })
  async create(@Body() dto: CreateBankAccountDto, @User() user: CurrentUser) {
    return this.bankAccountsService.create(dto, user.tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Mevcut tenant içine kayıtlı banka hesaplarını listele',
  })
  async findAll(@User() user: CurrentUser) {
    return this.bankAccountsService.findAll(user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Banka hesabını güncelle' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateBankAccountDto>,
    @User() user: CurrentUser,
  ) {
    return this.bankAccountsService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Banka hesabını sil' })
  async remove(@Param('id') id: string, @User() user: CurrentUser) {
    return this.bankAccountsService.remove(id, user.tenantId);
  }
}
