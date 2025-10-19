import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';
import { join } from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApp(@Res() res: Response) {
    return res.sendFile(join(__dirname, '..', 'public', 'dist', 'index.html'));
  }

  @Get('health')
  getHealth(): string {
    return this.appService.getHello();
  }
}
