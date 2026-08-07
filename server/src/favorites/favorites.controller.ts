import { Body, Controller, Delete, Get, Patch, Post, Query, Req } from '@nestjs/common'
import { FavoritesService } from './favorites.service'

@Controller('favorite-recipes')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.favoritesService.findAll(Number(req?.userId || 1))
  }

  @Post()
  upsert(@Req() req: any, @Body() body: any) {
    return this.favoritesService.upsert(Number(req?.userId || 1), body || {})
  }

  @Patch('completed')
  markCompleted(@Req() req: any, @Body() body: any) {
    return this.favoritesService.markCompleted(Number(req?.userId || 1), `${body?.name || ''}`)
  }

  @Delete()
  remove(@Req() req: any, @Query('name') name: string) {
    return this.favoritesService.remove(Number(req?.userId || 1), `${name || ''}`)
  }
}
