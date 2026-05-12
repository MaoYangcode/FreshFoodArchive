import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { createAuthToken } from '../common/auth-token'

const DEFAULT_PROFILE = {
  name: '微信用户',
  avatar: '',
  householdSize: 2,
  dietPreferences: [] as Prisma.JsonArray,
  avoidances: [] as Prisma.JsonArray,
  note: '',
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private getWeChatAppId() {
    return `${process.env.WECHAT_MINI_APP_ID || process.env.WECHAT_APP_ID || ''}`.trim()
  }

  private getWeChatAppSecret() {
    return `${process.env.WECHAT_MINI_APP_SECRET || process.env.WECHAT_APP_SECRET || ''}`.trim()
  }

  private async getOpenIdByCode(code: string) {
    const appId = this.getWeChatAppId()
    const appSecret = this.getWeChatAppSecret()
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('WECHAT_APP_ID/WECHAT_APP_SECRET 未配置')
    }
    if (!code) {
      throw new BadRequestException('缺少微信登录code')
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
    const res = await fetch(url)
    const json = (await res.json()) as any
    if (!res.ok || !json?.openid) {
      throw new BadRequestException(`微信登录失败: ${json?.errmsg || res.status}`)
    }
    return `${json.openid || ''}`.trim()
  }

  async wechatLogin(code: string) {
    const openId = await this.getOpenIdByCode(code)
    const current = await this.prisma.user.findUnique({
      where: { wechatOpenId: openId },
      select: { id: true },
    })
    if (current) {
      const token = createAuthToken(current.id)
      return {
        userId: current.id,
        isNewUser: false,
        token,
      }
    }
    const created = await this.prisma.user.create({
      data: {
        wechatOpenId: openId,
        ...DEFAULT_PROFILE,
      },
      select: { id: true },
    })
    const token = createAuthToken(created.id)
    return {
      userId: created.id,
      isNewUser: true,
      token,
    }
  }
}
