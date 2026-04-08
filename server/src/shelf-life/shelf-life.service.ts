import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const CATEGORIES = ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他']
const DEFAULT_RULES: Record<string, number> = {
  水果: 5,
  蔬菜: 3,
  肉类: 2,
  蛋奶: 5,
  海鲜: 2,
  饮料: 30,
  调味品: 90,
  其他: 7,
}

@Injectable()
export class ShelfLifeService {
  constructor(private readonly prisma: PrismaService) {}

  private clampDays(value: unknown, fallback = 7) {
    const n = Math.floor(Number(value))
    if (!Number.isFinite(n) || n <= 0) return fallback
    return Math.min(n, 3650)
  }

  private normalizeRules(raw: unknown) {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const rules: Record<string, number> = { ...DEFAULT_RULES }
    CATEGORIES.forEach((cat) => {
      rules[cat] = this.clampDays(source[cat], DEFAULT_RULES[cat])
    })
    return rules
  }

  private async ensureUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user) return user
    return this.prisma.user.create({ data: { id: userId } })
  }

  async getSettings(userId = 1) {
    const safeUserId = Math.max(Number(userId || 1), 1)
    await this.ensureUserExists(safeUserId)
    const row = await this.prisma.shelfLifeSetting.findUnique({
      where: { userId: safeUserId },
    })
    const rules = this.normalizeRules(row?.rules)
    const defaultDays = this.clampDays(row?.defaultDays, 7)
    return {
      userId: safeUserId,
      defaultDays,
      rules,
    }
  }

  async updateSettings(userId: number, payload: any) {
    const safeUserId = Math.max(Number(userId || 1), 1)
    await this.ensureUserExists(safeUserId)
    const rules = this.normalizeRules(payload?.rules)
    const defaultDays = this.clampDays(payload?.defaultDays, 7)
    await this.prisma.shelfLifeSetting.upsert({
      where: { userId: safeUserId },
      create: {
        userId: safeUserId,
        defaultDays,
        rules,
      },
      update: {
        defaultDays,
        rules,
      },
    })
    return {
      userId: safeUserId,
      defaultDays,
      rules,
    }
  }
}
