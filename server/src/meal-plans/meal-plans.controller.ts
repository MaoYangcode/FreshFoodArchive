import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common'
import { MealPlansService } from './meal-plans.service'

@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Get()
  findAll(@Req() req: any, @Query('date') date?: string) {
    return this.mealPlansService.findAll(Number(req?.userId || 1), `${date || ''}`)
  }

  @Post()
  upsert(@Req() req: any, @Body() body: any) {
    return this.mealPlansService.upsert(Number(req?.userId || 1), body || {})
  }

  @Patch(':id/completed')
  markCompleted(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.mealPlansService.markCompleted(Number(req?.userId || 1), id)
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.mealPlansService.remove(Number(req?.userId || 1), id)
  }
}
