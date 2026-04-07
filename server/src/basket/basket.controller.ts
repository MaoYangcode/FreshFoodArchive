import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'
import { BasketService } from './basket.service'

@Controller('basket-items')
export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  @Get()
  findAll(@Query('userId') userId?: string) {
    return this.basketService.findAll(Number(userId || 1))
  }

  @Post()
  create(@Body() body: any) {
    return this.basketService.create(Number(body?.userId || 1), body || {})
  }

  @Post('upsert')
  upsert(@Body() body: any) {
    return this.basketService.upsertItems(
      Number(body?.userId || 1),
      Array.isArray(body?.items) ? body.items : [],
      `${body?.sourceRecipeName || ''}`,
    )
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.basketService.toggleStatus(id, Number(body?.userId || 1))
  }

  @Delete('done/clear')
  clearDone(@Query('userId') userId?: string) {
    return this.basketService.clearDone(Number(userId || 1))
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Query('userId') userId?: string) {
    return this.basketService.remove(id, Number(userId || 1))
  }
}
