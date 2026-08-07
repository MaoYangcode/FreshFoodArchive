import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { MealPlansController } from './meal-plans.controller'
import { MealPlansService } from './meal-plans.service'

@Module({
  imports: [PrismaModule],
  controllers: [MealPlansController],
  providers: [MealPlansService],
})
export class MealPlansModule {}
