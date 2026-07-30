import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    return this.prisma.ingredient.findMany({
      where: {
        userId,
        quantity: {
          gt: 0,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async findOne(id: number, userId: number) {
    const item = await this.prisma.ingredient.findFirst({
      where: { id, userId },
    })
    if (!item) {
      throw new NotFoundException('食材不存在')
    }
    return item
  }

  async create(userId: number, data: any) {
    return this.prisma.ingredient.create({
      data: {
        name: data.name,
        category: data.category,
        quantity: Number(data.quantity),
        unit: data.unit,
        location: data.location,
        expireDate: data.expireDate ? new Date(data.expireDate) : null,
        userId,
      },
    })
  }

  async createBatch(userId: number, rawItems: unknown) {
    const items = Array.isArray(rawItems) ? rawItems : []
    if (!items.length || items.length > 20) {
      throw new BadRequestException('入库食材数量应为1至20项')
    }

    const normalized = items.map((raw: any, index) => {
      const name = `${raw?.name || ''}`.trim()
      const category = `${raw?.category || ''}`.trim()
      const unit = `${raw?.unit || ''}`.trim()
      const location = `${raw?.location || ''}`.trim()
      const quantity = Number(raw?.quantity)
      const expireDate = raw?.expireDate ? new Date(raw.expireDate) : null
      if (!name || !category || !unit || !location || !Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`第${index + 1}项入库信息不完整`)
      }
      if (expireDate && !Number.isFinite(expireDate.getTime())) {
        throw new BadRequestException(`第${index + 1}项过期日期无效`)
      }
      return { name, category, unit, location, quantity, expireDate, userId }
    })

    return this.prisma.$transaction(
      normalized.map((data) => this.prisma.ingredient.create({ data })),
    )
  }

  async remove(id: number, userId: number) {
  const item = await this.prisma.ingredient.findFirst({
    where: { id, userId },
  })

  if (!item) {
    throw new NotFoundException('食材不存在')
  }

  try {
    const [, deleted] = await this.prisma.$transaction([
      this.prisma.takeoutRecord.deleteMany({
        where: { ingredientId: id },
      }),
      this.prisma.ingredient.delete({
        where: { id },
      }),
    ])
    return deleted
  } catch (e) {
    throw new BadRequestException('删除失败：该食材存在关联记录或数据异常')
  }
}

  async update(id: number, userId: number, data: any) {
    const exists = await this.prisma.ingredient.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!exists) {
      throw new NotFoundException('食材不存在')
    }
    return this.prisma.ingredient.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        quantity: Number(data.quantity),
        unit: data.unit,
        location: data.location,
        expireDate: data.expireDate ? new Date(data.expireDate) : undefined,
      },
    })
  }

  async consume(id: number, userId: number, data: any) {
    const quantity = Number(data.quantity || 1)

    if (!quantity || quantity <= 0) {
      throw new BadRequestException('取出数量必须大于 0')
    }

    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, userId },
    })

    if (!ingredient) {
      throw new NotFoundException('食材不存在')
    }

    if (ingredient.quantity < quantity) {
      throw new BadRequestException('库存不足')
    }

    const updatedIngredient = await this.prisma.ingredient.update({
      where: { id },
      data: {
        quantity: ingredient.quantity - quantity,
      },
    })

    await this.prisma.takeoutRecord.create({
      data: {
        quantity,
        ingredientId: id,
      },
    })

    return updatedIngredient
  }

  async consumeBatch(userId: number, rawItems: unknown) {
    const source = Array.isArray(rawItems) ? rawItems : []
    if (!source.length || source.length > 50) {
      throw new BadRequestException('出库记录数量应为1至50项')
    }

    const quantitiesById = new Map<number, number>()
    source.forEach((raw: any, index) => {
      const id = Number(raw?.id)
      const quantity = Number(raw?.quantity)
      if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`第${index + 1}项出库信息无效`)
      }
      quantitiesById.set(id, (quantitiesById.get(id) || 0) + quantity)
    })

    const entries = [...quantitiesById.entries()].map(([id, quantity]) => ({ id, quantity }))
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.ingredient.findMany({
        where: {
          userId,
          id: { in: entries.map((item) => item.id) },
        },
      })
      const storedById = new Map(stored.map((item) => [item.id, item]))
      for (const entry of entries) {
        const ingredient = storedById.get(entry.id)
        if (!ingredient) throw new NotFoundException('出库食材不存在')
        if (ingredient.quantity < entry.quantity) {
          throw new BadRequestException(`${ingredient.name}库存不足`)
        }
      }

      const result: any[] = []
      for (const entry of entries) {
        const ingredient = storedById.get(entry.id)!
        const updated = await tx.ingredient.update({
          where: { id: entry.id },
          data: { quantity: ingredient.quantity - entry.quantity },
        })
        await tx.takeoutRecord.create({
          data: {
            quantity: entry.quantity,
            ingredientId: entry.id,
          },
        })
        result.push(updated)
      }
      return result
    })
  }

  async getTakeoutRecords(userId: number) {
  const records = await this.prisma.takeoutRecord.findMany({
    where: {
      ingredient: {
        userId,
      },
    },
    orderBy: {time: 'desc' }, 
    include: {
      ingredient: {
        select: {
          name: true,
          category: true,
          unit: true,
          location: true,
        },
      },
    },
  })

  return records.map((x) => ({
    id: x.id,
    name: x.ingredient?.name || '已删除食材',
    category: x.ingredient?.category || '其他',
    quantity: x.quantity,
    unit: x.ingredient?.unit || '',
    location: x.ingredient?.location || '',
    time: x.time, 
  }))
}
}
