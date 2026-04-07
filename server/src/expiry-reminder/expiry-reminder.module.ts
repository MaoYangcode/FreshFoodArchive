import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ExpiryReminderController } from './expiry-reminder.controller'
import { ExpiryReminderService } from './expiry-reminder.service'

@Module({
  imports: [PrismaModule],
  controllers: [ExpiryReminderController],
  providers: [ExpiryReminderService],
})
export class ExpiryReminderModule {}
