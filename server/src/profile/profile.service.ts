import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const DEFAULT_PROFILE = {
  name: '微信用户',
  avatar: '',
  householdSize: 2,
  dietPreferences: [] as string[],
  avoidances: [] as string[],
  note: '',
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeArray(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.map((x) => `${x || ''}`.trim()).filter(Boolean)
  }

  private normalizeName(value: unknown) {
    const text = `${value || ''}`.trim()
    return text || DEFAULT_PROFILE.name
  }

  private normalizeHouseholdSize(value: unknown) {
    const n = Number(value)
    if (!Number.isFinite(n)) return DEFAULT_PROFILE.householdSize
    return Math.min(Math.max(Math.round(n), 1), 10)
  }

  private normalizeNote(value: unknown) {
    return `${value || ''}`.trim().slice(0, 120)
  }

  private normalizeAvatar(value: unknown) {
    return `${value || ''}`.trim().slice(0, 300000)
  }

  private async ensureUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user) return user
    return this.prisma.user.create({
      data: {
        id: userId,
        ...DEFAULT_PROFILE,
        dietPreferences: [] as Prisma.JsonArray,
        avoidances: [] as Prisma.JsonArray,
      },
    })
  }

  private mapProfile(user: {
    id: number
    name: string | null
    avatar: string | null
    householdSize: number
    dietPreferences: Prisma.JsonValue | null
    avoidances: Prisma.JsonValue | null
    note: string | null
    updatedAt: Date
  }) {
    return {
      userId: user.id,
      name: user.name || DEFAULT_PROFILE.name,
      avatar: user.avatar || '',
      householdSize: this.normalizeHouseholdSize(user.householdSize),
      dietPreferences: this.normalizeArray(user.dietPreferences),
      avoidances: this.normalizeArray(user.avoidances),
      note: user.note || '',
      updatedAt: user.updatedAt,
    }
  }

  async getProfile(userId = 1) {
    const user = await this.ensureUserExists(userId)
    return this.mapProfile(user)
  }

  async updateProfile(userId: number, payload: any) {
    const current = await this.ensureUserExists(userId)
    const has = (key: string) => Object.prototype.hasOwnProperty.call(payload || {}, key)
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: has('name') ? this.normalizeName(payload?.name) : this.normalizeName(current?.name),
        avatar: has('avatar') ? this.normalizeAvatar(payload?.avatar) : this.normalizeAvatar(current?.avatar),
        householdSize: has('householdSize')
          ? this.normalizeHouseholdSize(payload?.householdSize)
          : this.normalizeHouseholdSize(current?.householdSize),
        dietPreferences: has('dietPreferences')
          ? (this.normalizeArray(payload?.dietPreferences) as Prisma.JsonArray)
          : (this.normalizeArray(current?.dietPreferences) as Prisma.JsonArray),
        avoidances: has('avoidances')
          ? (this.normalizeArray(payload?.avoidances) as Prisma.JsonArray)
          : (this.normalizeArray(current?.avoidances) as Prisma.JsonArray),
        note: has('note') ? this.normalizeNote(payload?.note) : this.normalizeNote(current?.note),
      },
    })
    return this.mapProfile(updated)
  }
}
