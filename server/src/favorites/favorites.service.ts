import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user) return user
    return this.prisma.user.create({ data: { id: userId } })
  }

  private toDate(value: unknown) {
    const date = value ? new Date(`${value}`) : null
    return date && !Number.isNaN(date.getTime()) ? date : null
  }

  private normalizeIngredients(raw: any) {
    return (Array.isArray(raw?.ingredients) ? raw.ingredients : [])
      .map((item: any) => ({
        ingredientName: `${item?.name || ''}`.trim(),
        quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : null,
        unit: `${item?.unit || ''}`.trim() || null,
      }))
      .filter((item: any) => !!item.ingredientName)
  }

  private toSnapshot(value: unknown): Prisma.InputJsonValue | undefined {
    if (!value || typeof value !== 'object') return undefined
    return value as Prisma.InputJsonValue
  }

  private mapRow(row: any) {
    const recipeSnapshot = row.snapshot && typeof row.snapshot === 'object'
      ? row.snapshot
      : {
          name: row.recipe?.name || '',
          duration: Number(row.recipe?.duration || 0),
          difficulty: row.recipe?.difficulty || '',
          steps: Array.isArray(row.recipe?.steps) ? row.recipe.steps : [],
          ingredients: (row.recipe?.ingredients || []).map((item: any) => ({
            name: item.ingredientName,
            quantity: item.quantity,
            unit: item.unit || '',
          })),
        }
    return {
      id: row.id,
      name: row.recipe?.name || recipeSnapshot?.name || '',
      duration: Number(row.recipe?.duration || recipeSnapshot?.duration || 0),
      difficulty: row.recipe?.difficulty || recipeSnapshot?.difficulty || '',
      raw: recipeSnapshot,
      available: [],
      missing: [],
      completedCount: Number(row.completedCount || 0),
      lastCompletedAt: row.lastCompletedAt || '',
      createdAt: row.favoritedAt,
      favoritedAt: row.favoritedAt,
    }
  }

  private includeRecipe() {
    return { recipe: { include: { ingredients: true } } } as const
  }

  async findAll(userId: number) {
    await this.ensureUserExists(userId)
    const rows = await this.prisma.favoriteRecipe.findMany({
      where: { userId },
      include: this.includeRecipe(),
      orderBy: { favoritedAt: 'desc' },
    })
    return rows.map((row) => this.mapRow(row))
  }

  async upsert(userId: number, raw: any) {
    await this.ensureUserExists(userId)
    const name = `${raw?.name || raw?.raw?.name || ''}`.trim()
    if (!name) throw new BadRequestException('菜谱名称不能为空')
    const snapshot = raw?.raw && typeof raw.raw === 'object' ? raw.raw : raw?.recipe
    const duration = Math.max(0, Number(raw?.duration || snapshot?.duration || 0))
    const difficulty = `${raw?.difficulty || snapshot?.difficulty || ''}`.trim() || null
    const steps = Array.isArray(snapshot?.steps) ? snapshot.steps : []
    const ingredients = this.normalizeIngredients(snapshot)
    const existing = await this.prisma.favoriteRecipe.findFirst({
      where: { userId, recipe: { name } },
      include: this.includeRecipe(),
    })
    if (existing) {
      await this.prisma.recipe.update({
        where: { id: existing.recipeId },
        data: {
          name,
          duration,
          difficulty,
          steps: steps as Prisma.InputJsonValue,
          ingredients: {
            deleteMany: {},
            create: ingredients,
          },
        },
      })
      const updated = await this.prisma.favoriteRecipe.update({
        where: { id: existing.id },
        data: {
          snapshot: this.toSnapshot(snapshot),
          completedCount: Math.max(Number(raw?.completedCount ?? existing.completedCount), 0),
          lastCompletedAt: this.toDate(raw?.lastCompletedAt) || existing.lastCompletedAt,
        },
        include: this.includeRecipe(),
      })
      return this.mapRow(updated)
    }
    const recipe = await this.prisma.recipe.create({
      data: {
        name,
        duration,
        difficulty,
        steps: steps as Prisma.InputJsonValue,
        ingredients: { create: ingredients },
      },
    })
    const favorite = await this.prisma.favoriteRecipe.create({
      data: {
        userId,
        recipeId: recipe.id,
        snapshot: this.toSnapshot(snapshot),
        completedCount: Math.max(Number(raw?.completedCount || 0), 0),
        lastCompletedAt: this.toDate(raw?.lastCompletedAt),
        favoritedAt: this.toDate(raw?.favoritedAt || raw?.createdAt) || new Date(),
      },
      include: this.includeRecipe(),
    })
    return this.mapRow(favorite)
  }

  async remove(userId: number, name: string) {
    const key = `${name || ''}`.trim()
    if (!key) throw new BadRequestException('菜谱名称不能为空')
    const current = await this.prisma.favoriteRecipe.findFirst({ where: { userId, recipe: { name: key } } })
    if (!current) return { success: true }
    await this.prisma.favoriteRecipe.delete({ where: { id: current.id } })
    return { success: true }
  }

  async markCompleted(userId: number, name: string) {
    const current = await this.prisma.favoriteRecipe.findFirst({
      where: { userId, recipe: { name: `${name || ''}`.trim() } },
      include: this.includeRecipe(),
    })
    if (!current) throw new NotFoundException('收藏菜谱不存在')
    const updated = await this.prisma.favoriteRecipe.update({
      where: { id: current.id },
      data: { completedCount: { increment: 1 }, lastCompletedAt: new Date() },
      include: this.includeRecipe(),
    })
    return this.mapRow(updated)
  }
}
