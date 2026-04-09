import { Body, Controller, Get, Put, Req } from '@nestjs/common'
import { ProfileService } from './profile.service'

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() req: any) {
    return this.profileService.getProfile(Number(req?.userId || 1))
  }

  @Put()
  updateProfile(@Req() req: any, @Body() body: any) {
    const userId = Number(req?.userId || 1)
    return this.profileService.updateProfile(userId, body || {})
  }
}
