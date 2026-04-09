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