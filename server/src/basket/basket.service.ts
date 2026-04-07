import { Injectable, NotFoundException } from '@nestjs/common'
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
}
