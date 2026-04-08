import { Injectable } from '@nestjs/common'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

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
  private readonly filePath = path.join(process.cwd(), 'data', 'shelf-life-settings.json')

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

  private async readStore(): Promise<Record<string, any>> {
    try {
      const text = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(text)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (_) {
      return {}
    }
  }

  private async writeStore(store: Record<string, any>) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(store, null, 2), 'utf8')
  }

  async getSettings(userId = 1) {
    const key = `${Math.max(Number(userId || 1), 1)}`
    const store = await this.readStore()
    const current = store[key] || {}
    const rules = this.normalizeRules(current.rules)
    const defaultDays = this.clampDays(current.defaultDays, 7)
    return {
      userId: Number(key),
      defaultDays,
      rules,
    }
  }

  async updateSettings(userId: number, payload: any) {
    const key = `${Math.max(Number(userId || 1), 1)}`
    const store = await this.readStore()
    const rules = this.normalizeRules(payload?.rules)
    const defaultDays = this.clampDays(payload?.defaultDays, 7)
    store[key] = {
      defaultDays,
      rules,
      updatedAt: new Date().toISOString(),
    }
    await this.writeStore(store)
    return {
      userId: Number(key),
      defaultDays,
      rules,
    }
  }
}
