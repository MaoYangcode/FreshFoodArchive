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
import { AuthModule } from './auth/auth.module'
import { RecipeKnowledgeModule } from './recipe-knowledge/recipe-knowledge.module'
import { FavoritesModule } from './favorites/favorites.module'
import { MealPlansModule } from './meal-plans/meal-plans.module'

@Module({
  imports: [PrismaModule, IngredientsModule, RecipeKnowledgeModule, AiModule, ExpiryReminderModule, BasketModule, ProfileModule, ShelfLifeModule, AuthModule, FavoritesModule, MealPlansModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
