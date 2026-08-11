import { Body, Controller, Delete, Get, Post, Query, Req } from '@nestjs/common'
import { AssistantHistoryService } from './assistant-history.service'

@Controller('assistant-history')
export class AssistantHistoryController {
  constructor(private readonly assistantHistoryService: AssistantHistoryService) {}

  @Get()
  findRecent(@Req() req: any, @Query('limit') limit?: string) {
    return this.assistantHistoryService.findRecent(Number(req?.userId || 1), Number(limit || 20))
  }

  @Post('turn')
  saveTurn(@Req() req: any, @Body() body: any) {
    return this.assistantHistoryService.saveTurn(Number(req?.userId || 1), body || {})
  }

  @Delete()
  clear(@Req() req: any) {
    return this.assistantHistoryService.clear(Number(req?.userId || 1))
  }
}
