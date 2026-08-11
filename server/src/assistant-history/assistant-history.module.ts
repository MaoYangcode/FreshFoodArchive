import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AssistantHistoryController } from './assistant-history.controller'
import { AssistantHistoryService } from './assistant-history.service'

@Module({
  imports: [PrismaModule],
  controllers: [AssistantHistoryController],
  providers: [AssistantHistoryService],
})
export class AssistantHistoryModule {}
