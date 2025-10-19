import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../common/decorators/user.decorator';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create customer' })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @User() user: any,
  ) {
    return this.customersService.create(createCustomerDto, user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers for tenant' })
  async findAll(@User() user: any) {
    return this.customersService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by id' })
  async findOne(@Param('id') id: string, @User() user: any) {
    return this.customersService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer' })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @User() user: any,
  ) {
    return this.customersService.update(id, updateCustomerDto, user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer' })
  async remove(@Param('id') id: string, @User() user: any) {
    return this.customersService.remove(id, user.tenantId);
  }
}
