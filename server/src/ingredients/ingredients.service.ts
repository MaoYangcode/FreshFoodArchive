import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ingredient.findMany({
      where: {
        quantity: {
          gt: 0,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async findOne(id: number) {
    const item = await this.prisma.ingredient.findUnique({
      where: { id },
    })
    if (!item) {
      throw new NotFoundException('食材不存在')
    }
    return item
  }

  async create(data: any) {
    return this.prisma.ingredient.create({
      data: {
        name: data.name,
        category: data.category,
        quantity: Number(data.quantity),
        unit: data.unit,
        location: data.location,
        expireDate: data.expireDate ? new Date(data.expireDate) : null,
        userId: data.userId ?? 1,
      },
    })
  }

  async remove(id: number) {
    return this.prisma.ingredient.delete({
      where: { id },
    })
  }

  async update(id: number, data: any) {
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

  async consume(id: number, data: any) {
    const quantity = Number(data.quantity || 1)

    if (!quantity || quantity <= 0) {
      throw new BadRequestException('取出数量必须大于 0')
    }

    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
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
}