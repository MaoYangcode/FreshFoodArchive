import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common'
import { BasketService } from './basket.service'

@Controller('basket-items')
export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.basketService.findAll(Number(req?.userId || 1))
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.basketService.create(Number(req?.userId || 1), body || {})
  }

  @Post('upsert')
  upsert(@Req() req: any, @Body() body: any) {
    return this.basketService.upsertItems(
      Number(req?.userId || 1),
      Array.isArray(body?.items) ? body.items : [],
      `${body?.sourceRecipeName || ''}`,
    )
  }

  @Patch(':id/toggle')
  toggle(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.basketService.toggleStatus(id, Number(req?.userId || 1))
  }

  @Delete('done/clear')
  clearDone(@Req() req: any) {
    return this.basketService.clearDone(Number(req?.userId || 1))
  }

  @Post('done/restock')
  restockDone(@Req() req: any, @Body() body: any) {
    return this.basketService.restockDone(Number(req?.userId || 1), body || {})
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.basketService.remove(id, Number(req?.userId || 1))
  }
}
