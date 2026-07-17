import { Controller, Get, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express'
import * as path from 'path'

const NUTRITION_ICON_FILES = new Set([
  'danbaizhi.svg',
  'reliang.svg',
  'xiaomai.svg',
  'yezi1.svg',
  'zhifangyouheruhuazhifangzhipin.svg',
])

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('iconfont.ttf')
  getIconFont(@Res() res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Content-Type', 'font/ttf')
    return res.sendFile(path.join(process.cwd(), '../static/iconfont/iconfont.ttf'))
  }

  @Get('nutrition-icons/:fileName')
  getNutritionIcon(@Param('fileName') fileName: string, @Res() res: Response) {
    const safeName = `${fileName || ''}`.trim()
    if (!NUTRITION_ICON_FILES.has(safeName)) return res.status(404).end()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    return res.sendFile(path.join(process.cwd(), 'assets/nutrition-icons', safeName))
  }
}
