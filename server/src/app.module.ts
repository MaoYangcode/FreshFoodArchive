import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { IngredientsModule } from './ingredients/ingredients.module'
import { PrismaModule } from './prisma/prisma.module'
import { AiModule } from './ai/ai.module'

@Module({
  imports: [PrismaModule, IngredientsModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
