import { Body, Controller, Get, Put, Req } from '@nestjs/common'
import { ShelfLifeService } from './shelf-life.service'

@Controller('shelf-life-settings')
export class ShelfLifeController {
  constructor(private readonly shelfLifeService: ShelfLifeService) {}

  @Get()
  getSettings(@Req() req: any) {
    return this.shelfLifeService.getSettings(Number(req?.userId || 1))
  }

  @Put()
  updateSettings(@Req() req: any, @Body() body: any) {
    return this.shelfLifeService.updateSettings(Number(req?.userId || 1), body || {})
  }
}
