import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { IngredientsModule } from './ingredients/ingredients.module'
import { PrismaModule } from './prisma/prisma.module'
import { AiModule } from './ai/ai.module'
import { ExpiryReminderModule } from './expiry-reminder/expiry-reminder.module'
import { BasketModule } from './basket/basket.module'
import { ProfileModule } from './profile/profile.module'
import { ShelfLifeModule } from './shelf-life/shelf-life.module'

@Module({
  imports: [PrismaModule, IngredientsModule, AiModule, ExpiryReminderModule, BasketModule, ProfileModule, ShelfLifeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
