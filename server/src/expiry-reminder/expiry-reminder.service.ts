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

const DEFAULT_SUBSCRIBE = {
  templateIds: [] as string[],
  authResult: {} as Record<string, string>,
  openId: '',
  templateData: {} as Record<string, string>,
  lastAuthAt: '',
  lastAuthStatus: 'unknown',
}

@Injectable()
export class ExpiryReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiryReminderService.name)
  private timer: NodeJS.Timeout | null = null
  private wxAccessTokenCache: { token: string; expiresAt: number } | null = null

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

  private normalizeSubscribe(raw: unknown) {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const templateIds = Array.isArray(source.templateIds)
      ? source.templateIds.map((x) => `${x || ''}`.trim()).filter(Boolean).slice(0, 20)
      : [...DEFAULT_SUBSCRIBE.templateIds]
    const authResultRaw = source.authResult && typeof source.authResult === 'object'
      ? (source.authResult as Record<string, unknown>)
      : {}
    const authResult: Record<string, string> = {}
    Object.keys(authResultRaw).forEach((key) => {
      const k = `${key || ''}`.trim()
      if (!k) return
      authResult[k] = `${authResultRaw[key] || ''}`.trim().slice(0, 32)
    })
    const lastAuthAtRaw = `${source.lastAuthAt || ''}`.trim()
    const parsed = lastAuthAtRaw ? new Date(lastAuthAtRaw) : null
    const lastAuthAt = parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : ''
    const lastAuthStatus = `${source.lastAuthStatus || ''}`.trim() || DEFAULT_SUBSCRIBE.lastAuthStatus
    const openId = `${source.openId || ''}`.trim().slice(0, 128)
    const templateDataRaw = source.templateData && typeof source.templateData === 'object'
      ? (source.templateData as Record<string, unknown>)
      : {}
    const templateData: Record<string, string> = {}
    Object.keys(templateDataRaw).forEach((key) => {
      const k = `${key || ''}`.trim()
      const v = `${templateDataRaw[key] || ''}`.trim()
      if (!k || !v) return
      templateData[k] = v.slice(0, 64)
    })
    return {
      templateIds,
      authResult,
      openId,
      templateData,
      lastAuthAt,
      lastAuthStatus,
    }
  }

  private getWeChatAppId() {
    return `${process.env.WECHAT_MINI_APP_ID || process.env.WECHAT_APP_ID || ''}`.trim()
  }

  private getWeChatAppSecret() {
    return `${process.env.WECHAT_MINI_APP_SECRET || process.env.WECHAT_APP_SECRET || ''}`.trim()
  }

  private pickAcceptedTemplateId(subscribe: ReturnType<ExpiryReminderService['normalizeSubscribe']>) {
    const auth = subscribe.authResult || {}
    for (const id of subscribe.templateIds || []) {
      if (`${auth[id] || ''}`.trim() === 'accept') return id
    }
    return ''
  }

  private async getWeChatAccessToken() {
    const appId = this.getWeChatAppId()
    const appSecret = this.getWeChatAppSecret()
    if (!appId || !appSecret) {
      throw new Error('WECHAT_APP_ID/WECHAT_APP_SECRET 未配置')
    }
    const now = Date.now()
    if (this.wxAccessTokenCache && this.wxAccessTokenCache.expiresAt > now + 10000) {
      return this.wxAccessTokenCache.token
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`
    const res = await fetch(url)
    const json = await res.json() as any
    if (!res.ok || !json?.access_token) {
      throw new Error(`获取微信access_token失败: ${json?.errmsg || res.status}`)
    }
    const ttlSec = Number(json?.expires_in || 7200)
    this.wxAccessTokenCache = {
      token: `${json.access_token}`,
      expiresAt: now + Math.max(300, ttlSec - 120) * 1000,
    }
    return this.wxAccessTokenCache.token
  }

  private async getOpenIdByCode(code: string) {
    const appId = this.getWeChatAppId()
    const appSecret = this.getWeChatAppSecret()
    if (!appId || !appSecret) return ''
    const safeCode = `${code || ''}`.trim()
    if (!safeCode) return ''
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}&js_code=${encodeURIComponent(safeCode)}&grant_type=authorization_code`
    const res = await fetch(url)
    const json = await res.json() as any
    if (!res.ok || !json?.openid) {
      this.logger.warn(`jscode2session failed: ${json?.errmsg || res.status}`)
      return ''
    }
    return `${json.openid || ''}`.trim()
  }

  private buildSubscribeMessageData(items: Array<{ name: string; daysLeft: number }>, subscribe: ReturnType<ExpiryReminderService['normalizeSubscribe']>) {
    const fromConfig = subscribe.templateData || {}
    if (Object.keys(fromConfig).length) {
      const mapped: Record<string, { value: string }> = {}
      Object.keys(fromConfig).forEach((k) => {
        mapped[k] = { value: fromConfig[k] }
      })
      return mapped
    }
    const first = items[0]
    const name = first ? `${first.name}` : '食材'
    const days = first ? `${first.daysLeft}` : '0'
    const now = new Date()
    const t = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')} ${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`
    // Default mapping for "保质期到期提醒" style template:
    // 物品名称 / 到期日期 / 物品类型 / 存放位置 / 剩余天数
    const expireDateText = first && Number.isFinite(first.daysLeft)
      ? (() => {
          const d = new Date()
          d.setHours(0, 0, 0, 0)
          d.setDate(d.getDate() + first.daysLeft)
          return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
        })()
      : t.slice(0, 10)
    return {
      thing1: { value: `${name}`.slice(0, 20) },
      date2: { value: expireDateText },
      thing3: { value: '食材' },
      thing4: { value: '冰箱' },
      number5: { value: `${days}` },
    }
  }

  private extractSubscribeFromRules(raw: unknown) {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    return this.normalizeSubscribe(source.__subscribe)
  }

  private mergeRulesAndSubscribe(rules: Record<string, number>, subscribe: ReturnType<ExpiryReminderService['normalizeSubscribe']>) {
    return {
      ...rules,
      __subscribe: subscribe,
    }
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
    const subscribe = this.extractSubscribeFromRules(row.rules)
    return {
      userId: row.userId,
      enabled: !!row.enabled,
      remindTime: this.normalizeRemindTime(row.remindTime),
      defaultDays,
      rules,
      subscribe,
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
          rules: this.mergeRulesAndSubscribe(DEFAULT_SETTINGS.rules, DEFAULT_SUBSCRIBE) as Prisma.JsonObject,
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
    const nextSubscribe = payload?.subscribe === undefined
      ? this.normalizeSubscribe(current.subscribe)
      : this.normalizeSubscribe(payload?.subscribe)
    const mergedRules = this.mergeRulesAndSubscribe(nextRules, nextSubscribe)

    const updated = await this.prisma.expiryReminderSetting.upsert({
      where: { userId },
      create: {
        userId,
        enabled: nextEnabled,
        remindTime: nextRemindTime,
        defaultDays: nextDefaultDays,
        rules: mergedRules as Prisma.JsonObject,
      },
      update: {
        enabled: nextEnabled,
        remindTime: nextRemindTime,
        defaultDays: nextDefaultDays,
        rules: mergedRules as Prisma.JsonObject,
      },
    })

    return this.normalizeSettingsRow(updated)
  }

  async updateSubscribe(userId: number, payload: any) {
    const current = await this.getSettings(userId)
    const currentSubscribe = this.normalizeSubscribe(current.subscribe)
    const raw = payload && typeof payload === 'object' ? payload : {}
    let openId = `${raw?.openId || currentSubscribe.openId || ''}`.trim()
    const code = `${raw?.code || ''}`.trim()
    if (!openId && code) {
      try {
        openId = await this.getOpenIdByCode(code)
      } catch (e: any) {
        this.logger.warn(`resolve openId failed: ${e?.message || e}`)
      }
    }
    return this.updateSettings(userId, {
      subscribe: {
        ...currentSubscribe,
        ...raw,
        openId,
      },
    })
  }

  private async sendSubscribeMessage(userId: number, subscribe: ReturnType<ExpiryReminderService['normalizeSubscribe']>, items: Array<{ name: string; daysLeft: number }>) {
    const templateId = this.pickAcceptedTemplateId(subscribe)
    const openId = `${subscribe.openId || ''}`.trim()
    if (!templateId) return { attempted: false, reason: 'no-template-authorized' }
    if (!openId) return { attempted: false, reason: 'no-openid' }
    if (!items.length) return { attempted: false, reason: 'no-items' }

    try {
      const token = await this.getWeChatAccessToken()
      const page = '/pages/profile/expiry-reminder'
      const payload = {
        touser: openId,
        template_id: templateId,
        page,
        data: this.buildSubscribeMessageData(items, subscribe),
      }
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as any
      const ok = Number(json?.errcode) === 0
      if (!ok) {
        this.logger.warn(`subscribe send failed user=${userId} code=${json?.errcode} msg=${json?.errmsg}`)
      }
      return {
        attempted: true,
        success: ok,
        errcode: Number(json?.errcode || 0),
        errmsg: `${json?.errmsg || ''}`.trim(),
        msgid: `${json?.msgid || ''}`.trim(),
      }
    } catch (e: any) {
      this.logger.warn(`subscribe send exception user=${userId} ${e?.message || e}`)
      return {
        attempted: true,
        success: false,
        errcode: -1,
        errmsg: `${e?.message || e}`,
      }
    }
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
    const sendResult = await this.sendSubscribeMessage(
      userId,
      this.normalizeSubscribe(settings.subscribe),
      items.map((x) => ({ name: x.name, daysLeft: x.daysLeft })),
    )

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
      subscribeSend: sendResult,
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
