import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class MealPlansService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user) return user
    return this.prisma.user.create({ data: { id: userId } })
  }

  private normalize(raw: any) {
    const allowedMeals = ['breakfast', 'lunch', 'dinner']
    const date = `${raw?.date || ''}`.slice(0, 10)
    const recipeName = `${raw?.recipeName || raw?.name || ''}`.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('计划日期格式不正确')
    if (!recipeName) throw new BadRequestException('菜谱名称不能为空')
    return {
      clientId: `${raw?.clientId || (typeof raw?.id === 'string' ? raw.id : '')}`.trim() || null,
      date,
      meal: allowedMeals.includes(raw?.meal) ? raw.meal : 'dinner',
      servings: Math.max(1, Math.floor(Number(raw?.servings || 1))),
      recipeName,
      duration: Math.max(0, Math.floor(Number(raw?.duration || 0))),
      difficulty: `${raw?.difficulty || ''}`.trim() || null,
      recipeSnapshot: raw?.recipe && typeof raw.recipe === 'object' ? raw.recipe as Prisma.InputJsonValue : undefined,
      status: raw?.status === 'completed' ? 'completed' : 'pending',
      completedAt: raw?.completedAt && !Number.isNaN(new Date(raw.completedAt).getTime()) ? new Date(raw.completedAt) : null,
    }
  }

  private mapRow(row: any) {
    return {
      id: row.id,
      clientId: row.clientId || '',
      date: row.date,
      meal: row.meal,
      servings: row.servings,
      recipeName: row.recipeName,
      duration: row.duration,
      difficulty: row.difficulty || '',
      recipe: row.recipeSnapshot && typeof row.recipeSnapshot === 'object' ? row.recipeSnapshot : null,
      status: row.status,
      completedAt: row.completedAt || '',
      createdAt: row.createdAt,
    }
  }

  async findAll(userId: number, date = '') {
    await this.ensureUserExists(userId)
    const rows = await this.prisma.mealPlan.findMany({
      where: { userId, ...(date ? { date: date.slice(0, 10) } : {}) },
      orderBy: [{ date: 'asc' }, { meal: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map((row) => this.mapRow(row))
  }

  async upsert(userId: number, raw: any) {
    await this.ensureUserExists(userId)
    const payload = this.normalize(raw)
    const existing = payload.clientId
      ? await this.prisma.mealPlan.findFirst({ where: { userId, clientId: payload.clientId } })
      : null
    const row = existing
      ? await this.prisma.mealPlan.update({ where: { id: existing.id }, data: payload })
      : await this.prisma.mealPlan.create({ data: { userId, ...payload } })
    return this.mapRow(row)
  }

  async remove(userId: number, id: number) {
    const current = await this.prisma.mealPlan.findFirst({ where: { id, userId } })
    if (!current) return { success: true }
    await this.prisma.mealPlan.delete({ where: { id } })
    return { success: true }
  }

  async markCompleted(userId: number, id: number) {
    const current = await this.prisma.mealPlan.findFirst({ where: { id, userId } })
    if (!current) throw new NotFoundException('饮食计划不存在')
    const row = await this.prisma.mealPlan.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    })
    return this.mapRow(row)
  }
}
