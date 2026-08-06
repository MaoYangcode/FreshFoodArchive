import { Module } from '@nestjs/common'
import { RecipeKnowledgeService } from './recipe-knowledge.service'

@Module({
  providers: [RecipeKnowledgeService],
  exports: [RecipeKnowledgeService],
})
export class RecipeKnowledgeModule {}
