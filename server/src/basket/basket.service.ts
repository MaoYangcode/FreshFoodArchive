import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const BASKET_CATEGORY_KEYWORDS: Record<string, string[]> = {
  调味品: [
    '盐',
    '糖',
    '白糖',
    '红糖',
    '冰糖',
    '酱油',
    '生抽',
    '老抽',
    '蚝油',
    '料酒',
    '醋',
    '陈醋',
    '香醋',
    '米醋',
    '胡椒',
    '胡椒粉',
    '花椒',
    '辣椒',
    '辣椒油',
    '豆瓣酱',
    '番茄酱',
    '沙拉酱',
    '芝麻酱',
    '橄榄油',
    '菜籽油',
    '花生油',
    '芝麻油',
    '香油',
    '食用油',
    '鸡精',
    '味精',
    '淀粉',
    '蜂蜜',
    '孜然',
    '十三香',
    '咖喱',
  ],
  蛋奶: ['鸡蛋', '鸭蛋', '鹅蛋', '牛奶', '酸奶', '奶酪', '黄油', '奶油', '芝士'],
  肉类: ['牛肉', '猪肉', '鸡肉', '鸭肉', '羊肉', '里脊', '排骨', '肉末', '腊肠', '火腿', '培根'],
  海鲜: ['虾', '鱼', '蟹', '贝', '蚝', '鱿鱼', '海参', '三文鱼', '金枪鱼', '带鱼', '鳕鱼'],
  水果: ['苹果', '香蕉', '橙', '橘', '柠檬', '梨', '桃', '西瓜', '葡萄', '芒果', '草莓', '蓝莓'],
  饮料: ['可乐', '雪碧', '果汁', '汽水', '苏打水', '矿泉水', '咖啡', '茶', '椰汁', '豆浆'],
}

const DEFAULT_RESTOCK_SHELF_LIFE_DAYS: Record<string, number> = {
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
export class BasketService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeName(name: unknown) {
    return `${name || ''}`.trim().replace(/\s+/g, '').toLowerCase()
  }

  private inferCategoryByName(name: unknown) {
    const text = `${name || ''}`.trim()
    if (!text) return '其他'
    for (const category of Object.keys(BASKET_CATEGORY_KEYWORDS)) {
      if (BASKET_CATEGORY_KEYWORDS[category].some((kw) => text.includes(kw))) return category
    }
    return '其他'
  }

  private pickCategory(rawCategory: unknown, name: unknown) {
    const normalized = `${rawCategory || ''}`.trim()
    if (normalized && normalized !== '其他') return normalized
    return this.inferCategoryByName(name)
  }

  private normalizeQuantity(value: unknown) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return 1
    return n
  }

  private normalizeShelfLifeDays(value: unknown, fallback: number) {
    const n = Math.floor(Number(value))
    if (!Number.isFinite(n) || n <= 0) return fallback
    if (n > 3650) return 3650
    return n
  }

  private normalizeRestockDate(rawDate: unknown) {
    const now = new Date()
    if (rawDate === null || rawDate === undefined || `${rawDate}`.trim() === '') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
    const date = new Date(`${rawDate}`)
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('入库日期格式不正确')
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  private normalizeExpireDate(rawDate: unknown) {
    if (rawDate === null || rawDate === undefined || `${rawDate}`.trim() === '') return undefined
    const date = new Date(`${rawDate}`)
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('过期日期格式不正确')
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  private normalizeRestockLocation(rawLocation: unknown, fallback = '冷藏') {
    const text = `${rawLocation || ''}`.trim()
    return text || fallback
  }

  private normalizeRestockCategory(rawCategory: unknown) {
    const text = `${rawCategory || ''}`.trim()
    if (!text) return ''
    return Object.prototype.hasOwnProperty.call(DEFAULT_RESTOCK_SHELF_LIFE_DAYS, text) ? text : ''
  }

  private addDays(baseDate: Date, days: number) {
    const value = new Date(baseDate)
    value.setDate(value.getDate() + days)
    return value
  }

  private normalizeShelfLifeByCategory(raw: unknown) {
    const map = { ...DEFAULT_RESTOCK_SHELF_LIFE_DAYS }
    if (!raw || typeof raw !== 'object') return map
    for (const category of Object.keys(DEFAULT_RESTOCK_SHELF_LIFE_DAYS)) {
      map[category] = this.normalizeShelfLifeDays(
        (raw as Record<string, unknown>)[category],
        DEFAULT_RESTOCK_SHELF_LIFE_DAYS[category],
      )
    }
    return map
  }

  private normalizePayload(raw: any, sourceRecipeName = '') {
    const name = `${raw?.name || ''}`.trim()
    return {
      name,
      normalizedName: this.normalizeName(name),
      quantity: this.normalizeQuantity(raw?.quantity),
      unit: `${raw?.unit || '份'}`.trim() || '份',
      category: this.pickCategory(raw?.category, name),
      status: raw?.status === 'done' ? 'done' : 'todo',
      sourceRecipeName: `${sourceRecipeName || raw?.sourceRecipeName || ''}`.trim(),
      note: `${raw?.note || ''}`.trim(),
    }
  }

  private async ensureUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user) return user
    return this.prisma.user.create({ data: { id: userId } })
  }

  async findAll(userId = 1) {
    await this.ensureUserExists(userId)
    return this.prisma.basketItem.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async create(userId: number, raw: any) {
    await this.ensureUserExists(userId)
    const payload = this.normalizePayload(raw)
    if (!payload.name) {
      throw new NotFoundException('食材名不能为空')
    }
    return this.prisma.basketItem.create({
      data: {
        userId,
        ...payload,
      },
    })
  }

  async upsertItems(userId: number, rawItems: any[], sourceRecipeName = '') {
    await this.ensureUserExists(userId)
    if (!Array.isArray(rawItems) || !rawItems.length) return { added: 0, merged: 0 }

    let added = 0
    let merged = 0
    for (const raw of rawItems) {
      const item = this.normalizePayload(raw, sourceRecipeName)
      if (!item.name) continue

      const existing = await this.prisma.basketItem.findFirst({
        where: {
          userId,
          normalizedName: item.normalizedName,
          status: 'todo',
        },
      })

      if (!existing) {
        await this.prisma.basketItem.create({
          data: {
            userId,
            ...item,
          },
        })
        added += 1
        continue
      }

      await this.prisma.basketItem.update({
        where: { id: existing.id },
        data: {
          quantity: Number(existing.quantity || 0) + Number(item.quantity || 0),
          unit: existing.unit || item.unit,
          category: this.pickCategory(existing.category || item.category, existing.name || item.name),
          sourceRecipeName: existing.sourceRecipeName || item.sourceRecipeName,
        },
      })
      merged += 1
    }

    return { added, merged }
  }

  async toggleStatus(id: number, userId: number) {
    const current = await this.prisma.basketItem.findFirst({
      where: { id, userId },
    })
    if (!current) throw new NotFoundException('条目不存在')
    return this.prisma.basketItem.update({
      where: { id },
      data: {
        status: current.status === 'done' ? 'todo' : 'done',
      },
    })
  }

  async remove(id: number, userId: number) {
    const current = await this.prisma.basketItem.findFirst({
      where: { id, userId },
    })
    if (!current) throw new NotFoundException('条目不存在')
    await this.prisma.basketItem.delete({ where: { id } })
    return { success: true }
  }

  async clearDone(userId: number) {
    const result = await this.prisma.basketItem.deleteMany({
      where: {
        userId,
        status: 'done',
      },
    })
    return { count: result.count }
  }

  async restockDone(userId: number, raw: any) {
    await this.ensureUserExists(userId)

    const restockDate = this.normalizeRestockDate(raw?.restockDate)
    const location = this.normalizeRestockLocation(raw?.location, '冷藏')
    const defaultShelfLifeDays = this.normalizeShelfLifeDays(raw?.defaultShelfLifeDays, 7)
    const shelfLifeByCategory = this.normalizeShelfLifeByCategory(raw?.shelfLifeDaysByCategory)
    const itemSettings = Array.isArray(raw?.itemSettings) ? raw.itemSettings : []
    const itemSettingMap = new Map<
      number,
      { restockDate: Date; location: string; category?: string; quantity?: number; unit?: string; expireDate?: Date }
    >()
    for (const setting of itemSettings) {
      const id = Number(setting?.id)
      if (!Number.isFinite(id) || id <= 0) continue
      const hasQuantity = setting?.quantity !== null && setting?.quantity !== undefined && `${setting?.quantity}`.trim() !== ''
      itemSettingMap.set(id, {
        restockDate: this.normalizeRestockDate(setting?.restockDate ?? restockDate),
        location: this.normalizeRestockLocation(setting?.location, location),
        category: this.normalizeRestockCategory(setting?.category) || undefined,
        quantity: hasQuantity ? this.normalizeQuantity(setting?.quantity) : undefined,
        unit: `${setting?.unit || ''}`.trim() || undefined,
        expireDate: this.normalizeExpireDate(setting?.expireDate),
      })
    }

    const doneItems = await this.prisma.basketItem.findMany({
      where: {
        userId,
        status: 'done',
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!doneItems.length) {
      return {
        sourceCount: 0,
        created: 0,
        removed: 0,
        restockDate,
        shelfLifeByCategory,
      }
    }

    const ingredientRows = doneItems.map((item) => {
      const setting = itemSettingMap.get(item.id)
      const settingCategory = this.normalizeRestockCategory(setting?.category)
      const category = settingCategory || this.pickCategory(item.category, item.name)
      const days = this.normalizeShelfLifeDays(shelfLifeByCategory[category], defaultShelfLifeDays)
      const rowRestockDate = setting?.restockDate || restockDate
      const rowLocation = setting?.location || location
      const rowQuantity = this.normalizeQuantity(setting?.quantity ?? item.quantity)
      const rowUnit = `${setting?.unit || item.unit || '份'}`.trim() || '份'
      const rowExpireDate = setting?.expireDate || this.addDays(rowRestockDate, days)
      return {
        userId,
        name: item.name,
        category,
        quantity: rowQuantity,
        unit: rowUnit,
        location: rowLocation,
        expireDate: rowExpireDate,
      }
    })

    const [createdResult, removedResult] = await this.prisma.$transaction([
      this.prisma.ingredient.createMany({
        data: ingredientRows,
      }),
      this.prisma.basketItem.deleteMany({
        where: {
          userId,
          id: { in: doneItems.map((x) => x.id) },
        },
      }),
    ])

    return {
      sourceCount: doneItems.length,
      created: createdResult.count,
      removed: removedResult.count,
      restockDate,
      shelfLifeByCategory,
    }
  }
}
