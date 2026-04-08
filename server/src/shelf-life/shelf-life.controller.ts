import { Body, Controller, Get, Put, Query } from '@nestjs/common'
import { ShelfLifeService } from './shelf-life.service'

@Controller('shelf-life-settings')
export class ShelfLifeController {
  constructor(private readonly shelfLifeService: ShelfLifeService) {}

  @Get()
  getSettings(@Query('userId') userId?: string) {
    return this.shelfLifeService.getSettings(Number(userId || 1))
  }

  @Put()
  updateSettings(@Body() body: any) {
    return this.shelfLifeService.updateSettings(Number(body?.userId || 1), body || {})
  }
}
