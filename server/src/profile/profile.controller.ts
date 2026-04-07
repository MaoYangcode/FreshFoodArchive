import { Body, Controller, Get, Put, Query } from '@nestjs/common'
import { ProfileService } from './profile.service'

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Query('userId') userId?: string) {
    return this.profileService.getProfile(Number(userId || 1))
  }

  @Put()
  updateProfile(@Body() body: any) {
    const userId = Number(body?.userId || 1)
    return this.profileService.updateProfile(userId, body || {})
  }
}
