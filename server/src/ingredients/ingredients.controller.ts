import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'
import { IngredientsService } from './ingredients.service'

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  findAll() {
    return this.ingredientsService.findAll()
  }

  @Get('takeout-records')
  getTakeoutRecords() {
    return this.ingredientsService.getTakeoutRecords()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.findOne(id)
  }

  @Post()
  create(@Body() body: any) {
    return this.ingredientsService.create(body)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ingredientsService.remove(id)
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.ingredientsService.update(id, body)
  }

  @Post(':id/consume')
  consume(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.ingredientsService.consume(id, body)
  }
}
