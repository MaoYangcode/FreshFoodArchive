import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { BasketController } from './basket.controller'
import { BasketService } from './basket.service'

@Module({
  imports: [PrismaModule],
  controllers: [BasketController],
  providers: [BasketService],
})
export class BasketModule {}
