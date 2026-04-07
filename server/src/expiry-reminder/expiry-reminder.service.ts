import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const CATEGORY_LIST = ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他']

const DEFAULT_SETTINGS = {
  enabled: true,
  remindTime: '09:00',
  defaultDays: 2,
  rules: {
    水果: 1,
    蔬菜: 2,
    肉类: 3,
    蛋奶: 2,
    海鲜: 1,
    饮料: 5,
    调味品: 7,
    其他: 2,
  } as Record<string, number>,
}

@Injectable()
export class ExpiryReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiryReminderService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.runScheduledScan().catch((e) => {
        this.logger.error(`scheduled scan failed: ${e?.message || e}`)
      })
    }, 30000)
  }

  onModuleDestroy() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private clampDays(value: unknown) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.min(Math.max(Math.round(n), 0), 30)
  }

  private normalizeRules(raw: unknown, defaultDays: number) {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const rules: Record<string, number> = {}
    CATEGORY_LIST.forEach((cat) => {
      const candidate = source[cat]
      if (candidate === undefined || candidate === null) {
        rules[cat] = defaultDays
        return
      }
      rules[cat] = this.clampDays(candidate)
    })
    return rules
  }

  private normalizeRemindTime(value: unknown) {
    const text = `${value || ''}`.trim()
    if (/^\d{2}:\d{2}$/.test(text)) return text
    return DEFAULT_SETTINGS.remindTime
  }

  private normalizeSettingsRow(row: {
    enabled: boolean
    remindTime: string
    defaultDays: number
    rules: Prisma.JsonValue | null
    lastTriggeredAt: Date | null
    userId: number
  }) {
    const defaultDays = this.clampDays(row.defaultDays)
    const rules = this.normalizeRules(row.rules, defaultDays)
    return {
      userId: row.userId,
      enabled: !!row.enabled,
      remindTime: this.normalizeRemindTime(row.remindTime),
      defaultDays,
      rules,
      lastTriggeredAt: row.lastTriggeredAt,
    }
  }

  private async ensureUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user) return user
    return this.prisma.user.create({
      data: {
        id: userId,
      },
    })
  }

  async getSettings(userId = 1) {
    await this.ensureUserExists(userId)
    const setting = await this.prisma.expiryReminderSetting.findUnique({
      where: { userId },
    })
    if (!setting) {
      const created = await this.prisma.expiryReminderSetting.create({
        data: {
          userId,
          ...DEFAULT_SETTINGS,
          rules: DEFAULT_SETTINGS.rules as Prisma.JsonObject,
        },
      })
      return this.normalizeSettingsRow(created)
    }
    return this.normalizeSettingsRow(setting)
  }

  async updateSettings(userId: number, payload: any) {
    const current = await this.getSettings(userId)
    const nextEnabled = payload?.enabled === undefined ? current.enabled : !!payload.enabled
    const nextRemindTime = this.normalizeRemindTime(payload?.remindTime || current.remindTime)
    const nextDefaultDays =
      payload?.defaultDays === undefined ? current.defaultDays : this.clampDays(payload.defaultDays)
    const nextRules = this.normalizeRules(payload?.rules ?? current.rules, nextDefaultDays)

    const updated = await this.prisma.expiryReminderSetting.upsert({
      where: { userId },
      create: {
        userId,
        enabled: nextEnabled,
        remindTime: nextRemindTime,
        defaultDays: nextDefaultDays,
        rules: nextRules as Prisma.JsonObject,
      },
      update: {
        enabled: nextEnabled,
        remindTime: nextRemindTime,
        defaultDays: nextDefaultDays,
        rules: nextRules as Prisma.JsonObject,
      },
    })

    return this.normalizeSettingsRow(updated)
  }

  private getDaysLeft(expireDate: Date | null) {
    if (!expireDate) return Number.POSITIVE_INFINITY
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const target = new Date(expireDate)
    target.setHours(0, 0, 0, 0)
    return Math.floor((target.getTime() - now.getTime()) / (24 * 3600 * 1000))
  }

  private async collectRemindItems(userId: number) {
    const settings = await this.getSettings(userId)
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        userId,
        quantity: { gt: 0 },
      },
      orderBy: { expireDate: 'asc' },
    })

    const byCategory: Record<string, number> = {}
    const items = ingredients
      .map((item) => {
        const category = CATEGORY_LIST.includes(`${item.category || ''}`) ? `${item.category}` : '其他'
        const limitDays = settings.rules[category] ?? settings.defaultDays
        const daysLeft = this.getDaysLeft(item.expireDate)
        const shouldRemind = Number.isFinite(daysLeft) && daysLeft >= 0 && daysLeft <= limitDays
        return {
          id: item.id,
          name: item.name,
          category,
          expireDate: item.expireDate,
          daysLeft,
          shouldRemind,
        }
      })
      .filter((x) => x.shouldRemind)
      .map((x) => ({
        id: x.id,
        name: x.name,
        category: x.category,
        expireDate: x.expireDate,
        daysLeft: x.daysLeft,
      }))

    items.forEach((item) => {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1
    })

    return {
      settings,
      items,
      summary: byCategory,
    }
  }

  private isSameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  async scanNow(userId = 1, source = 'manual') {
    const { settings, items, summary } = await this.collectRemindItems(userId)
    const now = new Date()

    const log = await this.prisma.expiryReminderLog.create({
      data: {
        userId,
        source,
        triggerAt: now,
        total: items.length,
        summary: summary as Prisma.JsonObject,
        items: items as Prisma.JsonArray,
      },
    })

    await this.prisma.expiryReminderSetting.update({
      where: { userId },
      data: { lastTriggeredAt: now },
    })

    return {
      triggeredAt: now,
      enabled: settings.enabled,
      remindTime: settings.remindTime,
      total: items.length,
      summary,
      items,
      logId: log.id,
    }
  }

  async getLogs(userId = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 100)
    const rows = await this.prisma.expiryReminderLog.findMany({
      where: { userId },
      orderBy: { triggerAt: 'desc' },
      take: safeLimit,
    })
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      triggerAt: row.triggerAt,
      total: row.total,
      summary: row.summary || {},
      items: row.items || [],
    }))
  }

  private async runScheduledScan() {
    const now = new Date()
    const hh = `${now.getHours()}`.padStart(2, '0')
    const mm = `${now.getMinutes()}`.padStart(2, '0')
    const targetTime = `${hh}:${mm}`

    const candidates = await this.prisma.expiryReminderSetting.findMany({
      where: {
        enabled: true,
        remindTime: targetTime,
      },
      select: {
        userId: true,
        lastTriggeredAt: true,
      },
    })

    for (const item of candidates) {
      if (item.lastTriggeredAt && this.isSameDay(item.lastTriggeredAt, now)) continue
      await this.scanNow(item.userId, 'scheduled')
    }
  }
}
