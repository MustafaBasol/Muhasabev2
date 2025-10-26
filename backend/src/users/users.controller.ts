import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Mevcut kullanıcının profilini getir
   */
  @Get('me')
  async getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  /**
   * Mevcut kullanıcının profilini güncelle
   */
  @Put('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Request() req, @Body() updateData: any) {
    const userId = req.user.id;
    
    console.log('📝 Update data received:', updateData);
    
    const filteredData: any = {};
    
    // name field'ı gelirse firstName/lastName olarak ayır
    if (updateData.name) {
      const nameParts = updateData.name.trim().split(' ');
      filteredData.firstName = nameParts[0] || '';
      filteredData.lastName = nameParts.slice(1).join(' ') || '';
      console.log('✅ Name parsed:', filteredData);
    }
    
    // firstName ve lastName direkt gelirse kullan
    if (updateData.firstName !== undefined) {
      filteredData.firstName = updateData.firstName;
    }
    if (updateData.lastName !== undefined) {
      filteredData.lastName = updateData.lastName;
    }

    console.log('📦 Final filtered data:', filteredData);

    // Boş update engelle
    if (Object.keys(filteredData).length === 0) {
      console.log('⚠️ No fields to update, returning current user');
      return this.usersService.findOne(userId);
    }

    return this.usersService.update(userId, filteredData);
  }
}
