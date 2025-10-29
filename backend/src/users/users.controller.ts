import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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

  /**
   * GDPR: Export user's personal data
   */
  @Get('me/export')
  async exportData(@Request() req, @Res() res: Response) {
    try {
      const userId = req.user.id;
      const zipBuffer = await this.usersService.exportUserData(userId);
      
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="my_data_export.zip"',
        'Content-Length': zipBuffer.length.toString(),
      });
      
      res.send(zipBuffer);
    } catch (error) {
      console.error('Data export error:', error);
      res.status(500).json({ 
        error: 'Data export failed', 
        message: error.message 
      });
    }
  }

  /**
   * GDPR: Request account deletion
   */
  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  async requestDeletion(@Request() req, @Body() deleteRequest: { confirmPassword?: string }) {
    const userId = req.user.id;
    
    // In production, you might want to verify password
    // const isPasswordValid = await this.usersService.verifyPassword(userId, deleteRequest.confirmPassword);
    // if (!isPasswordValid) {
    //   throw new UnauthorizedException('Password verification required');
    // }
    
    await this.usersService.requestAccountDeletion(userId);
    
    return {
      message: 'Account deletion has been scheduled. You will receive a confirmation email.',
      status: 'pending_deletion',
      deletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    };
  }
}
