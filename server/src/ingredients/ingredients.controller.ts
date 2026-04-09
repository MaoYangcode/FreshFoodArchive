import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common'
import { IngredientsService } from './ingredients.service'

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.ingredientsService.findAll(Number(req?.userId || 1))
  }

  @Get('takeout-records')
  getTakeoutRecords(@Req() req: any) {
    return this.ingredientsService.getTakeoutRecords(Number(req?.userId || 1))
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.findOne(id, Number(req?.userId || 1))
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.ingredientsService.create(Number(req?.userId || 1), body)
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.remove(id, Number(req?.userId || 1))
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.ingredientsService.update(id, Number(req?.userId || 1), body)
  }

  @Post(':id/consume')
  consume(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.ingredientsService.consume(id, Number(req?.userId || 1), body)
  }
}
