import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const RETENTION_DAYS = 7
const MAX_MESSAGES = 30
const DEFAULT_VISIBLE_MESSAGES = 20

@Injectable()
export class AssistantHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUserExists(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (user) return user
    return this.prisma.user.create({ data: { id: userId } })
  }

  private retentionCutoff() {
    return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  }

  private async prune(userId: number) {
    await this.prisma.assistantMessage.deleteMany({
      where: { userId, createdAt: { lt: this.retentionCutoff() } },
    })
    const overflow = await this.prisma.assistantMessage.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: MAX_MESSAGES,
      select: { id: true },
    })
    if (overflow.length) {
      await this.prisma.assistantMessage.deleteMany({
        where: { id: { in: overflow.map((row) => row.id) } },
      })
    }
  }

  private mapRow(row: any) {
    return {
      id: row.id,
      turnId: row.turnId,
      role: row.role,
      content: row.content,
      intent: row.intent || '',
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async findRecent(userId: number, requestedLimit = DEFAULT_VISIBLE_MESSAGES) {
    await this.ensureUserExists(userId)
    await this.prune(userId)
    const limit = Math.min(MAX_MESSAGES, Math.max(2, Math.floor(requestedLimit || DEFAULT_VISIBLE_MESSAGES)))
    const rows = await this.prisma.assistantMessage.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    return rows.reverse().map((row) => this.mapRow(row))
  }

  async saveTurn(userId: number, raw: any) {
    await this.ensureUserExists(userId)
    const turnId = `${raw?.turnId || ''}`.trim().slice(0, 64)
    const transcript = `${raw?.transcript || ''}`.trim().slice(0, 2000)
    const reply = `${raw?.reply || ''}`.trim().slice(0, 4000)
    const intent = `${raw?.intent || ''}`.trim().slice(0, 40) || null
    const metadata = raw?.metadata && typeof raw.metadata === 'object'
      ? raw.metadata as Prisma.InputJsonValue
      : Prisma.JsonNull
    if (!turnId || !transcript || !reply) throw new BadRequestException('聊天记录内容不完整')

    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.assistantMessage.upsert({
        where: { userId_turnId_role: { userId, turnId, role: 'user' } },
        create: { userId, turnId, role: 'user', content: transcript, intent, createdAt: now },
        update: { content: transcript, intent },
      }),
      this.prisma.assistantMessage.upsert({
        where: { userId_turnId_role: { userId, turnId, role: 'assistant' } },
        create: { userId, turnId, role: 'assistant', content: reply, intent, metadata, createdAt: new Date(now.getTime() + 1) },
        update: { content: reply, intent, metadata },
      }),
    ])
    await this.prune(userId)
    return { success: true, turnId }
  }

  async clear(userId: number) {
    await this.prisma.assistantMessage.deleteMany({ where: { userId } })
    return { success: true }
  }
}
