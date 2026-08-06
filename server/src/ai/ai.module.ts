import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { RecipeKnowledgeModule } from '../recipe-knowledge/recipe-knowledge.module'

@Module({
  imports: [RecipeKnowledgeModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
