import { Body, Controller, Get, Post, Put, Query, Req } from '@nestjs/common'
import { ExpiryReminderService } from './expiry-reminder.service'

@Controller('expiry-reminder')
export class ExpiryReminderController {
  constructor(private readonly expiryReminderService: ExpiryReminderService) {}

  @Get('settings')
  getSettings(@Req() req: any) {
    return this.expiryReminderService.getSettings(Number(req?.userId || 1))
  }

  @Put('settings')
  updateSettings(@Req() req: any, @Body() body: any) {
    const userId = Number(req?.userId || 1)
    return this.expiryReminderService.updateSettings(userId, body || {})
  }

  @Post('subscribe')
  updateSubscribe(@Req() req: any, @Body() body: any) {
    const userId = Number(req?.userId || 1)
    return this.expiryReminderService.updateSubscribe(userId, body || {})
  }

  @Get('logs')
  getLogs(@Req() req: any, @Query('limit') limit?: string) {
    return this.expiryReminderService.getLogs(Number(req?.userId || 1), Number(limit || 20))
  }

  @Post('scan-now')
  scanNow(@Req() req: any) {
    const userId = Number(req?.userId || 1)
    return this.expiryReminderService.scanNow(userId, 'manual')
  }
}
