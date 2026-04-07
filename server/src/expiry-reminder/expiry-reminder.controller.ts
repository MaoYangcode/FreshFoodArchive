import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common'
import { ExpiryReminderService } from './expiry-reminder.service'

@Controller('expiry-reminder')
export class ExpiryReminderController {
  constructor(private readonly expiryReminderService: ExpiryReminderService) {}

  @Get('settings')
  getSettings(@Query('userId') userId?: string) {
    return this.expiryReminderService.getSettings(Number(userId || 1))
  }

  @Put('settings')
  updateSettings(@Body() body: any) {
    const userId = Number(body?.userId || 1)
    return this.expiryReminderService.updateSettings(userId, body || {})
  }

  @Get('logs')
  getLogs(@Query('userId') userId?: string, @Query('limit') limit?: string) {
    return this.expiryReminderService.getLogs(Number(userId || 1), Number(limit || 20))
  }

  @Post('scan-now')
  scanNow(@Body() body: any) {
    const userId = Number(body?.userId || 1)
    return this.expiryReminderService.scanNow(userId, 'manual')
  }
}
