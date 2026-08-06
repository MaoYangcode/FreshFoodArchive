import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { RecipeKnowledgeDocument, RecipeKnowledgeHit, RecipeKnowledgeService } from '../recipe-knowledge/recipe-knowledge.service'

type RecognizedIngredient = {
  name: string
  category: string
  confidence?: number
  quantity?: number
  unit?: string
}

type GeneratedRecipe = {
  id: string
  name: string
  duration: number
  difficulty: string
  matchScore?: number
  coverImage: string
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>
  steps: string[]
  tips?: string
  servings?: number
  nutrition?: RecipeNutrition
  detailReady?: boolean
  knowledgeId?: string
  retrievalSource?: string
  matchedIngredients?: string[]
  missingIngredients?: string[]
}

type RecipeNutrition = {
  calories: number
  protein: number
  fat: number
  carbohydrates: number
  fiber: number
  sodium: number
  analysis: string
}

type ProfileApplied = {
  userId: number
  avoidances: string[]
  dietPreferences: string[]
  cookwareNote: string
  strictAvoidance: boolean
  softCookware: boolean
  requestedCount: number
  generatedCount: number
  reducedByAvoidance: boolean
  removedByAvoidanceCount: number
}

type RecipeGenerateResult = {
  recipes: GeneratedRecipe[]
  profileApplied: ProfileApplied
}

type RecipeGenerateTaskStatus = 'pending' | 'generating' | 'done' | 'failed'

type RecipeGenerateTask = {
  taskId: string
  status: RecipeGenerateTaskStatus
  recipes: GeneratedRecipe[]
  doneCount: number
  totalCount: number
  message: string
  profileApplied: ProfileApplied | null
  createdAt: number
  updatedAt: number
  expiresAt: number
  errors: string[]
}

type VoiceRecognizeResult = {
  text: string
  name: string
  quantity?: number
  unit?: string
  items?: Array<{
    name: string
    quantity?: number
    unit?: string
    category?: string
  }>
}

type AssistantIntent =
  | 'inventory_add'
  | 'inventory_consume'
  | 'inventory_read'
  | 'expiry_read'
  | 'recipe_request'
  | 'unknown'

type AssistantCommand = {
  intent: AssistantIntent
  transcript: string
  items: Array<{
    name: string
    quantity?: number
    unit?: string
    category?: string
    location?: string
    expireDate?: string
  }>
  query: {
    target?: string
    scope?: string
    location?: string
  }
  recipe: {
    ingredients: string[]
    maxDuration?: number
    difficulty?: string
    taste?: string
  }
  reply: string
  confidence: number
  requiresConfirmation: boolean
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeKnowledge: RecipeKnowledgeService,
  ) {}
  private readonly logger = new Logger(AiService.name)
  private readonly recipeTasks = new Map<string, RecipeGenerateTask>()
  private readonly speechAudio = new Map<string, {
    sourceUrl: string
    expiresAt: number
    buffer?: Buffer
    contentType?: string
  }>()

  private readonly apiKey = process.env.DASHSCOPE_API_KEY || ''
  private readonly endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  private readonly asrEndpoint =
    process.env.DASHSCOPE_ASR_ENDPOINT ||
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  private readonly visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen3.6-flash'
  private readonly textModel = process.env.DASHSCOPE_TEXT_MODEL || 'qwen2.5-14b-instruct'
  private readonly asrModel = process.env.DASHSCOPE_ASR_MODEL || 'qwen3-asr-flash'
  private readonly recipeRetryEnabled = `${process.env.AI_RECIPE_ENABLE_RETRY || ''}`.trim() === '1'
  private readonly allowMockFallback =
    `${process.env.AI_RECOGNIZE_FALLBACK_TO_MOCK || ''}`.trim() === '1'
  private readonly validCategories = new Set(['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'])
  private readonly ingredientAliasMap: Record<string, string> = {
    西红柿: '番茄',
    圣女果: '小番茄',
    马铃薯: '土豆',
    洋芋: '土豆',
    生菜叶: '生菜',
    油麦菜: '生菜',
    西芹: '芹菜',
    挂面: '面条',
    意面: '面条',
    意大利面: '面条',
    乌冬面: '面条',
    里脊肉: '猪肉',
    猪里脊: '猪肉',
    五花肉: '猪肉',
    牛里脊: '牛肉',
    牛腩: '牛肉',
    肥牛: '牛肉',
    基围虾: '虾',
    明虾: '虾',
    白虾: '虾',
    冻虾仁: '虾仁',
    杏鲍菇: '蘑菇',
    平菇: '蘑菇',
    口蘑: '蘑菇',
    鸡胸: '鸡胸肉',
  }

  createRecipeGenerateTask(payload: any) {
    this.cleanupRecipeTasks()
    const count = Math.min(Math.max(Number(payload?.count || 6), 1), 10)
    const taskId = `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const now = Date.now()
    const task: RecipeGenerateTask = {
      taskId,
      status: 'pending',
      recipes: [],
      doneCount: 0,
      totalCount: count,
      message: '正在生成菜谱',
      profileApplied: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 10 * 60 * 1000,
      errors: [],
    }
    this.recipeTasks.set(taskId, task)
    setTimeout(() => {
      this.runRecipeGenerateTask(taskId, payload).catch((error) => {
        const current = this.recipeTasks.get(taskId)
        if (!current) return
        current.status = current.recipes.length ? 'done' : 'failed'
        current.message = current.recipes.length ? '已生成部分菜谱' : error?.message || '菜谱生成失败'
        current.errors.push(error?.message || `${error || 'unknown error'}`)
        current.updatedAt = Date.now()
      })
    }, 0)
    return this.toRecipeTaskSnapshot(task)
  }

  getRecipeGenerateTask(taskId: string) {
    this.cleanupRecipeTasks()
    const task = this.recipeTasks.get(`${taskId || ''}`.trim())
    return task ? this.toRecipeTaskSnapshot(task) : null
  }

  private toRecipeTaskSnapshot(task: RecipeGenerateTask) {
    return {
      taskId: task.taskId,
      status: task.status,
      recipes: task.recipes.slice(0, task.totalCount),
      doneCount: Math.min(task.recipes.length, task.totalCount),
      totalCount: task.totalCount,
      message: task.message,
      profileApplied: task.profileApplied,
      updatedAt: task.updatedAt,
      errors: task.errors.slice(-3),
    }
  }

  private cleanupRecipeTasks() {
    const now = Date.now()
    for (const [taskId, task] of this.recipeTasks.entries()) {
      if (task.expiresAt <= now) this.recipeTasks.delete(taskId)
    }
  }

  private async runRecipeGenerateTask(taskId: string, payload: any) {
    const task = this.recipeTasks.get(taskId)
    if (!task) return
    task.status = 'generating'
    task.message = '正在生成菜谱'
    task.updatedAt = Date.now()

    const totalCount = task.totalCount
    const knowledgeResult = await this.generateRecipeList({
      ...(payload || {}),
      count: totalCount,
      summaryOnly: true,
      knowledgeOnly: true,
    })
    for (const recipe of knowledgeResult.recipes || []) {
      task.recipes.push(recipe)
      if (task.recipes.length >= totalCount) break
    }
    task.doneCount = task.recipes.length
    task.profileApplied = knowledgeResult.profileApplied
    task.updatedAt = Date.now()
    if (task.recipes.length >= totalCount) {
      task.status = 'done'
      task.message = '菜谱推荐完成'
      this.logger.log(`recipe-task-knowledge-hit taskId=${taskId}, returned=${task.recipes.length}`)
      return
    }

    const batchSizes = this.makeRecipeBatchSizes(totalCount - task.recipes.length, 2)
    const batchFocus = ['快炒、凉拌、快手菜', '炖焖、汤羹、蒸煮菜', '主食、馅料、烤煎菜']
    const maxConcurrency = 2
    let cursor = 0
    let running = 0

    await new Promise<void>((resolve) => {
      const launchNext = () => {
        if (!this.recipeTasks.has(taskId)) {
          resolve()
          return
        }
        if (cursor >= batchSizes.length && running <= 0) {
          resolve()
          return
        }
        while (running < maxConcurrency && cursor < batchSizes.length) {
          const batchIndex = cursor
          const batchCount = batchSizes[cursor]
          cursor += 1
          running += 1
          this.runRecipeGenerateBatch(taskId, payload, batchCount, batchIndex, batchFocus[batchIndex % batchFocus.length])
            .catch((error) => {
              const current = this.recipeTasks.get(taskId)
              if (current) {
                current.errors.push(error?.message || `${error || 'unknown error'}`)
                current.updatedAt = Date.now()
              }
            })
            .finally(() => {
              running -= 1
              launchNext()
            })
        }
      }
      launchNext()
    })

    const current = this.recipeTasks.get(taskId)
    if (!current) return
    current.doneCount = Math.min(current.recipes.length, current.totalCount)
    current.status = current.recipes.length ? 'done' : 'failed'
    current.message = current.recipes.length >= current.totalCount ? '菜谱生成完成' : '已生成部分菜谱'
    current.updatedAt = Date.now()
    this.logger.log(
      `recipe-task-total taskId=${taskId}, returned=${current.doneCount}, total=${current.totalCount}, errors=${current.errors.length}`,
    )
  }

  private makeRecipeBatchSizes(totalCount: number, preferredSize: number) {
    const sizes: number[] = []
    let remaining = Math.max(0, Math.floor(totalCount))
    while (remaining > 0) {
      const size = Math.min(preferredSize, remaining)
      sizes.push(size)
      remaining -= size
    }
    return sizes
  }

  private async runRecipeGenerateBatch(
    taskId: string,
    payload: any,
    batchCount: number,
    batchIndex: number,
    batchFocus: string,
  ) {
    const task = this.recipeTasks.get(taskId)
    if (!task) return
    const existingNames = task.recipes.map((x) => x.name).filter(Boolean)
    const excludeNames = [...this.normalizeStringArray(payload?.excludeNames), ...existingNames]

    const result = await this.generateRecipeList({
      ...(payload || {}),
      count: batchCount,
      excludeNames,
      batchFocus,
      summaryOnly: true,
      allowMockFallback: false,
      requestNonce: `${payload?.requestNonce || taskId}_${batchIndex}_${Date.now()}`,
    })
    const current = this.recipeTasks.get(taskId)
    if (!current) return
    const seen = new Set(current.recipes.map((x) => this.normalizeRecipeNameForDedupe(x.name)))
    for (const recipe of result.recipes || []) {
      const key = this.normalizeRecipeNameForDedupe(recipe?.name)
      if (!key || seen.has(key)) continue
      current.recipes.push({
        ...recipe,
        id: `${taskId}_${batchIndex + 1}_${current.recipes.length + 1}`,
      })
      seen.add(key)
      if (current.recipes.length >= current.totalCount) break
    }
    current.doneCount = Math.min(current.recipes.length, current.totalCount)
    current.profileApplied = result.profileApplied || current.profileApplied
    current.message = current.doneCount >= current.totalCount ? '菜谱生成完成' : `已生成 ${current.doneCount}/${current.totalCount}`
    current.updatedAt = Date.now()
    this.logger.log(
      `recipe-task-batch taskId=${taskId}, batch=${batchIndex + 1}, requested=${batchCount}, accepted=${current.doneCount}, focus=${batchFocus}`,
    )
  }

  async recognizeIngredientFromImage(file: any): Promise<RecognizedIngredient[]> {
    if (!this.apiKey) {
      if (this.allowMockFallback) return this.mockRecognize()
      throw new Error('DASHSCOPE_API_KEY 未配置')
    }

    const mimeType = file?.mimetype || 'image/jpeg'
    const imageBase64 = file?.buffer?.toString('base64')
    if (!imageBase64) return []

    const prompt = [
      '请识别图片中的食材，只返回 JSON，不要额外文本。',
      '如果图片中有多个食材，必须全部识别并逐条输出，不要只返回一个。',
      'JSON 结构：{"ingredients":[{"name":"食材名","category":"类别","quantity":3,"unit":"个","confidence":0.95}]}',
      'category 仅可取：水果、蔬菜、肉类、蛋奶、海鲜、饮料、调味品、其他。',
      'quantity 和 unit 必须返回。对番茄、鸡蛋、土豆等可数食材按画面中可见数量逐个计数，不能全部默认写 1。',
      '成把、成袋或成盒的食材使用“把”“袋”“盒”等单位；无法准确逐个计数时，给出合理估算数量并使用“份”。',
      'confidence 范围是 0 到 1，可选。',
      '如果无法识别，返回 {"ingredients":[]}',
    ].join('\n')

    const dataUrl = `data:${mimeType};base64,${imageBase64}`
    try {
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是食材识别助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.35,
        600,
      )

      const primary = this.extractIngredientsFromResponse(content)
      if (primary.length) return primary

      const enhanced = await this.runIngredientEnhancePass(dataUrl)
      return enhanced
    } catch (error: any) {
      if (this.allowMockFallback) return this.mockRecognize()
      throw new Error(error?.message || '食材识别服务调用失败')
    }
  }

  async recognizeReceiptFromImage(file: any): Promise<RecognizedIngredient[]> {
    if (!this.apiKey) {
      if (this.allowMockFallback) return this.mockRecognize()
      throw new Error('DASHSCOPE_API_KEY 未配置')
    }

    const mimeType = file?.mimetype || 'image/jpeg'
    const imageBase64 = file?.buffer?.toString('base64')
    if (!imageBase64) return []

    const prompt = [
      '你是购物小票识别助手。请从小票图片中提取可入库的食材条目，只返回 JSON。',
      '若识别到多条食材，请全部逐条返回，不要省略。',
      '请忽略金额、门店信息、时间、会员、优惠、合计等非食材信息。',
      'JSON 结构：{"ingredients":[{"name":"食材名","category":"类别","quantity":2,"unit":"个","confidence":0.9}]}',
      'category 仅可取：水果、蔬菜、肉类、蛋奶、海鲜、饮料、调味品、其他。',
      'quantity、unit、confidence 可选；confidence 范围 0 到 1。',
      '若无法识别食材，返回 {"ingredients":[]}',
    ].join('\n')

    const dataUrl = `data:${mimeType};base64,${imageBase64}`
    try {
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是结构化小票 OCR 助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.35,
        900,
      )

      const primary = this.extractIngredientsFromResponse(content)
      if (primary.length) return primary

      const enhanced = await this.runReceiptEnhancePass(dataUrl)
      return enhanced
    } catch (error: any) {
      if (this.allowMockFallback) return this.mockRecognize()
      throw new Error(error?.message || '小票识别服务调用失败')
    }
  }

  async recognizeTextFromAudio(file: any): Promise<VoiceRecognizeResult> {
    if (!this.apiKey) {
      throw new Error('DASHSCOPE_API_KEY 未配置')
    }

    const audioBase64 = file?.buffer?.toString('base64')
    if (!audioBase64) return { text: '', name: '' }
    const audioMimeType = this.inferAudioMimeType(file?.mimetype, file?.originalname)
    const dataUri = `data:${audioMimeType};base64,${audioBase64}`

    try {
      // qwen3-asr-flash on DashScope ASR endpoint expects pure audio content.
      // Keep structured extraction in local post-processing for stability.
      const content = await this.callDashScope(
        this.asrModel,
        [
          {
            role: 'user',
            content: [{ audio: dataUri }],
          },
        ],
        false,
      )
      const parsed = this.parseJson(content)
      const text = (
        `${parsed?.text || parsed?.result || parsed?.transcript || ''}`.trim() ||
        `${content || ''}`.trim()
      )
        .replace(/\s+/g, ' ')
        .trim()
      const fallback = this.parseVoiceTextFallback(text)
      const parsedSingle = this.parseVoiceSingleItem(`${parsed?.name || ''}`.trim())
      const name = parsedSingle.name || fallback.name
      const quantity = this.normalizeVoiceQuantity(parsed?.quantity ?? parsedSingle.quantity ?? fallback.quantity)
      const unit = `${parsed?.unit || parsedSingle.unit || ''}`.trim() || fallback.unit
      const items = this.normalizeVoiceItems(
        Array.isArray(parsed?.items) ? parsed.items : [],
        fallback.items || [],
        { name, quantity, unit },
      )
      return {
        text,
        name,
        quantity,
        unit: unit || undefined,
        items,
      }
    } catch (error: any) {
      throw new Error(error?.message || '语音识别服务调用失败')
    }
  }

  async parseAssistantCommand(text: unknown): Promise<AssistantCommand> {
    const transcript = `${text || ''}`.replace(/\s+/g, ' ').trim()
    if (!transcript) return this.buildAssistantCommandFallback('')

    const schema = {
      intent: 'inventory_add | inventory_consume | inventory_read | expiry_read | recipe_request | unknown',
      items: [
        {
          name: '食材名',
          quantity: 2,
          unit: '个',
          category: '蔬菜',
          location: '冷藏',
          expireDate: '2026-07-28',
        },
      ],
      query: { target: '鸡蛋', scope: 'all | target | expiring', location: '冷藏 | 冷冻' },
      recipe: { ingredients: ['番茄'], maxDuration: 20, difficulty: '简单', taste: '清淡' },
      reply: '准备向用户展示的简短确认语',
      confidence: 0.95,
    }
    const prompt = [
      '你是冰箱库存与菜谱语音助手的指令解析器。只返回 JSON，不要执行任何操作。',
      `用户原话：${transcript}`,
      `今天日期：${new Date().toISOString().slice(0, 10)}`,
      '意图说明：inventory_add=食材入库；inventory_consume=取出、吃掉、喝掉或用掉食材；inventory_read=查询或朗读库存；expiry_read=查询或朗读临期/过期食材；recipe_request=请求菜谱；unknown=无法判断。',
      '提取用户明确说出的食材、数量、单位、存放位置和日期。没有说出的字段不要猜测。',
      '“喝完了、吃完了、用完了”属于 inventory_consume，但数量可以留空，后续必须确认。',
      '“冰箱里有什么、还剩多少、朗读库存”属于 inventory_read。',
      '库存查询如果明确说了冷藏区或冷冻区，在 query.location 中原样返回“冷藏”或“冷冻”。',
      '“有什么快过期、读一下临期食材”属于 expiry_read。',
      '菜谱请求要提取指定食材、最长用时、难度和口味。',
      'reply 使用简短自然的中文，说明你理解到了什么；不要声称已经完成入库、出库或删除。',
      `JSON 结构：${JSON.stringify(schema)}`,
    ].join('\n')

    if (!this.apiKey) return this.buildAssistantCommandFallback(transcript)
    try {
      const content = await this.callDashScope(
        this.textModel,
        [
          { role: 'system', content: '你是结构化语音指令解析助手，只输出 JSON。' },
          { role: 'user', content: prompt },
        ],
        true,
        0.1,
        900,
      )
      const parsed = this.parseJson(content)
      return this.normalizeAssistantCommand(parsed?.command || parsed, transcript)
    } catch (error: any) {
      this.logger.warn(`assistant-command-parse fallback: ${error?.message || error || 'unknown'}`)
      return this.buildAssistantCommandFallback(transcript)
    }
  }

  async synthesizeSpeech(text: unknown) {
    const value = `${text || ''}`.replace(/\s+/g, ' ').trim().slice(0, 600)
    if (!value) throw new Error('朗读文字为空')
    if (!this.apiKey) throw new Error('语音合成服务未配置')
    const payload = await this.postDashScopeJson(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        model: process.env.AI_TTS_MODEL || 'qwen3-tts-flash',
        input: {
          text: value,
          voice: process.env.AI_TTS_VOICE || 'Cherry',
          language_type: 'Chinese',
        },
      },
    )
    const rawUrl = `${payload?.output?.audio?.url || ''}`.trim()
    if (!rawUrl) throw new Error(payload?.message || '语音合成未返回音频')
    for (const [key, audio] of this.speechAudio.entries()) {
      if (audio.expiresAt <= Date.now()) this.speechAudio.delete(key)
    }
    const audioId = randomUUID()
    const expiresAt = Date.now() + 10 * 60 * 1000
    this.speechAudio.set(audioId, {
      sourceUrl: rawUrl.replace(/^http:\/\//i, 'https://'),
      expiresAt,
    })
    return { audioPath: `/ai/speech-audio/${audioId}`, expiresAt }
  }

  async getSpeechAudio(audioId: string) {
    const key = `${audioId || ''}`.trim()
    const current = this.speechAudio.get(key)
    if (!current || current.expiresAt <= Date.now()) {
      this.speechAudio.delete(key)
      throw new Error('朗读音频已失效')
    }
    if (current.buffer) {
      return {
        buffer: current.buffer,
        contentType: current.contentType || 'audio/wav',
      }
    }
    const response = await fetch(current.sourceUrl)
    if (!response.ok) throw new Error('朗读音频下载失败')
    const buffer = Buffer.from(await response.arrayBuffer())
    current.buffer = buffer
    current.contentType = response.headers.get('content-type') || 'audio/wav'
    return { buffer, contentType: current.contentType }
  }

  async generateRecipeList(payload: any): Promise<RecipeGenerateResult> {
    const startedAt = Date.now()
    const ingredients = Array.isArray(payload?.ingredients) ? payload.ingredients : []
    const count = Math.min(Math.max(Number(payload?.count || 6), 1), 10)
    const cookingTime = Number(payload?.cookingTime || 30)
    const tastePreference = `${payload?.tastePreference || '家常'}`
    const excludeNames = this.normalizeStringArray(payload?.excludeNames)
    const requestNonce = `${payload?.requestNonce || ''}`.trim()
    const batchFocus = `${payload?.batchFocus || ''}`.trim()
    const summaryOnly = payload?.summaryOnly === true
    const knowledgeOnly = payload?.knowledgeOnly === true
    const allowRecipeMockFallback = payload?.allowMockFallback !== false
    const userId = Math.max(Number(payload?.userId || 1), 1)
    const profile = await this.loadUserProfileForRecipe(userId)
    const profileMs = Date.now() - startedAt
    const avoidances = profile.avoidances
    const dietPreferences = profile.dietPreferences
    const cookwareNote = profile.note
    const profileApplied: ProfileApplied = {
      userId,
      avoidances,
      dietPreferences,
      cookwareNote,
      strictAvoidance: true,
      softCookware: true,
      requestedCount: count,
      generatedCount: 0,
      reducedByAvoidance: false,
      removedByAvoidanceCount: 0,
    }

    if (!ingredients.length) return { recipes: [], profileApplied }
    const pantryNames = ingredients
      .map((x: any) => `${x?.name || ''}`.trim())
      .filter(Boolean)
    const knowledgeHits = await this.recipeKnowledge.search({
      ingredients: pantryNames,
      limit: Math.max(count * 4, 12),
      maxDuration: cookingTime,
      taste: tastePreference,
      avoidances,
      excludeNames,
    })
    const knowledgeRecipes = this.filterRecipesByAvoidances(
      knowledgeHits.map((hit) => this.knowledgeHitToGeneratedRecipe(hit, summaryOnly)),
      avoidances,
    ).slice(0, count)
    if (knowledgeRecipes.length >= count) {
      profileApplied.generatedCount = count
      this.logger.log(`recipe-knowledge-hit returned=${count}, mode=${knowledgeHits[0]?.retrievalMode || 'local-hybrid'}`)
      return { recipes: knowledgeRecipes.slice(0, count), profileApplied }
    }
    if (knowledgeOnly) {
      profileApplied.generatedCount = knowledgeRecipes.length
      return { recipes: knowledgeRecipes, profileApplied }
    }
    if (!this.apiKey) {
      if (!allowRecipeMockFallback) {
        if (knowledgeRecipes.length) {
          profileApplied.generatedCount = knowledgeRecipes.length
          return { recipes: knowledgeRecipes, profileApplied }
        }
        throw new Error('DASHSCOPE_API_KEY 未配置')
      }
      const mocked = this.filterRecipesByAvoidances(this.mockRecipes(ingredients, count), avoidances)
        .map((item, idx) => this.normalizeRecipe(item, idx, summaryOnly))
      const combined = this.dedupeRecipesByName([...knowledgeRecipes, ...mocked]).slice(0, count)
      profileApplied.generatedCount = combined.length
      profileApplied.removedByAvoidanceCount = Math.max(count - combined.length, 0)
      profileApplied.reducedByAvoidance = profileApplied.removedByAvoidanceCount > 0
      return { recipes: combined, profileApplied }
    }

    const ingredientText = ingredients
      .map((x: any) => {
        const name = `${x?.name || ''}`.trim()
        const quantity = x?.quantity !== undefined ? `${x.quantity}` : ''
        const unit = x?.unit || ''
        return `${name}${quantity}${unit}`.trim()
      })
      .filter(Boolean)
      .join('、')
    const uniquePantryNames = Array.from(new Set(pantryNames.map((x) => this.normalizeTextForCompare(x)))).filter(Boolean)
    const isSingleIngredientMode = uniquePantryNames.length === 1
    const singleIngredientGuidance = isSingleIngredientMode
      ? [
          '单一库存食材场景：请围绕这个核心食材生成 6 道不同常见家常菜。',
          '允许补充常见主料、辅料和调味料来让菜成立，不要因为库存只有一种食材而反复犹豫或返回空。',
          '6 道菜应覆盖不同做法，例如快炒、炖/焖、汤、主食/馅料、蒸/煮、凉拌/快手菜；不要只换调料重复同一种菜。',
        ].join('\n')
      : [
          '多食材场景：优先覆盖不同库存食材，保持菜式多样。',
        ].join('\n')

    const outputSchema = summaryOnly
      ? '{"recipes":[{"id":"ai_001","name":"菜名","duration":15,"difficulty":"简单","ingredients":[{"name":"番茄","quantity":2,"unit":"个"}]}]}'
      : '{"recipes":[{"id":"ai_001","name":"菜名","duration":15,"difficulty":"简单","matchScore":95,"coverImage":"","ingredients":[{"name":"番茄","quantity":2,"unit":"个"}],"steps":["步骤1","步骤2"],"tips":"可选"}]}'
    const prompt = [
      '你是家庭烹饪助手。仅返回 JSON，不要附带解释文本。',
      '请根据给定食材生成菜谱候选列表。',
      `口味偏好：${tastePreference}`,
      `饮食偏好（软约束，尽量贴合）：${dietPreferences.length ? dietPreferences.join('、') : '无特别偏好'}`,
      `可用厨具（软约束，尽量贴合）：${cookwareNote || '按常见家用厨具处理'}`,
      `忌口食材（硬约束，必须严格避开）：${avoidances.length ? avoidances.join('、') : '无'}`,
      '规则：任何菜谱名称、食材列表、步骤、tips 中都不允许出现忌口食材或其同义表述。',
      `期望总烹饪时长（分钟）：${cookingTime}`,
      `候选数量：${count}`,
      `已展示菜谱名（禁止重复）：${excludeNames.length ? excludeNames.join('、') : '无'}`,
      batchFocus ? `本批菜式方向：${batchFocus}` : '',
      `本次生成随机标识：${requestNonce || 'none'}`,
      `食材：${ingredientText}`,
      singleIngredientGuidance,
      '菜谱合理性要求（必须遵守）：',
      '1) 菜名必须是常见家常菜，不要生造菜名，不要出现明显违和组合（如“苹果炒土豆”）。',
      '2) 每道菜至少命中 1 种库存食材（库存优先）。',
      '3) 允许补充 1-3 种常见缺失食材来让菜谱成立（如“土豆炖牛肉”可补充牛肉）。',
      '4) 不要为了凑数量输出不符合常理的菜。',
      '5) 同一批结果要尽量多样：优先覆盖不同库存食材，不要多数菜都围绕同一个主食材。',
      '6) 菜名和做法不得语义重复，例如“白菜猪肉饺子”和“白菜猪肉馅饺子”属于同一道菜，只能保留一个。',
      'JSON 结构：',
      outputSchema,
      'difficulty 仅可取：简单、中等、困难。',
      summaryOnly ? '本次只生成列表摘要，不要返回 steps、tips、matchScore、nutrition 等详情字段。' : 'matchScore 范围 0-100。',
      summaryOnly ? '' : 'steps 按实际烹饪需要返回，不限制步数；每一步都要具体可执行（包含关键动作或火候信息）。',
      '如果无法生成，返回 {"recipes":[]}',
    ].join('\n')

    let content = ''
    let dashScopeMs = 0
    try {
      const dashScopeStartedAt = Date.now()
      content = await this.callDashScope(
        this.textModel,
        [
          { role: 'system', content: '你是结构化 JSON 菜谱生成助手。' },
          { role: 'user', content: prompt },
        ],
        true,
        0.2,
        summaryOnly ? 900 : 2200,
      )
      dashScopeMs = Date.now() - dashScopeStartedAt
    } catch (err) {
      dashScopeMs = dashScopeMs || Date.now() - startedAt - profileMs
      this.logger.warn(
        `DashScope generate-recipe failed, fallback to mock: ${err?.message || err || 'unknown error'}; ingredientCount=${pantryNames.length}, singleIngredient=${isSingleIngredientMode}, profileMs=${profileMs}, dashScopeMs=${dashScopeMs}, totalMs=${Date.now() - startedAt}`,
      )
      if (!allowRecipeMockFallback) {
        if (knowledgeRecipes.length) {
          profileApplied.generatedCount = knowledgeRecipes.length
          return { recipes: knowledgeRecipes, profileApplied }
        }
        throw new Error(err?.message || '菜谱生成服务调用失败')
      }
      const mocked = this.filterRecipesByAvoidances(this.mockRecipes(ingredients, count), avoidances)
        .map((item, idx) => this.normalizeRecipe(item, idx, summaryOnly))
      const combined = this.dedupeRecipesByName([...knowledgeRecipes, ...mocked]).slice(0, count)
      profileApplied.generatedCount = combined.length
      profileApplied.removedByAvoidanceCount = Math.max(count - combined.length, 0)
      profileApplied.reducedByAvoidance = profileApplied.removedByAvoidanceCount > 0
      return { recipes: combined, profileApplied }
    }

    const parsed = this.parseJson(content)
    const list = this.pickRecipeArray(parsed)
    const fallbackRecipes = !list.length ? this.parseRecipeArrayFallback(content) : []
    const recipeSource = list.length ? list : fallbackRecipes
    let recipes = recipeSource
      .map((item: any, idx: number) => this.normalizeRecipe(item, idx, summaryOnly))
      .filter((x: GeneratedRecipe) => !!x.name && (summaryOnly || x.steps.length > 0))
    recipes = this.dedupeRecipesByName(recipes)
    const recipesBeforeExclude = recipes.slice()
    if (excludeNames.length) {
      const blocked = new Set(excludeNames.map((x) => this.normalizeRecipeNameForDedupe(x)))
      recipes = recipes.filter((x) => !blocked.has(this.normalizeRecipeNameForDedupe(x.name)))
    }
    const recipesBeforeAnyStrictFilter = recipes.slice()
    const recipesBeforePantryFilter = recipes.slice()
    const pantryFiltered = recipes.filter((x) => this.recipeUsesPantryIngredients(x, pantryNames))
    if (!pantryFiltered.length && recipesBeforePantryFilter.length) {
      this.logger.warn(
        `Pantry filter removed all AI recipes, fallback to unfiltered AI candidates. pantry=[${pantryNames.join(',')}]`,
      )
      recipes = recipesBeforePantryFilter
    } else {
      recipes = pantryFiltered
    }
    const beforeFilterCount = recipes.length
    recipes = this.filterRecipesByAvoidances(recipes, avoidances)
    const parsedMs = Date.now() - startedAt - profileMs - dashScopeMs
    this.logger.log(
      `recipe-filter-stats parsed=${list.length}, fallbackParsed=${fallbackRecipes.length}, normalized=${recipesBeforeExclude.length}, afterExclude=${recipesBeforeAnyStrictFilter.length}, afterPantry=${beforeFilterCount}, afterAvoidance=${recipes.length}, ingredientCount=${pantryNames.length}, singleIngredient=${isSingleIngredientMode}, profileMs=${profileMs}, dashScopeMs=${dashScopeMs}, parseFilterMs=${Math.max(parsedMs, 0)}`,
    )
    let removedByAvoidanceCount = Math.max(beforeFilterCount - recipes.length, 0)

    const shouldRetry = (this.recipeRetryEnabled || excludeNames.length > 0) && recipes.length < count
    if (shouldRetry) {
      const remain = count - recipes.length
      const retryPrompt = [
        '你是家庭烹饪助手。仅返回 JSON，不要附带解释文本。',
        `请补充生成 ${remain} 道新菜谱，且与已有菜谱不要重复。`,
        `已有菜谱名：${[...excludeNames, ...recipes.map((x) => x.name)].filter(Boolean).join('、') || '无'}`,
        `以下菜名绝对禁止出现：${[...excludeNames, ...recipes.map((x) => x.name)].filter(Boolean).join('、') || '无'}`,
        batchFocus ? `本批菜式方向：${batchFocus}` : '',
        '如果菜名与已有菜谱重复，则该条视为无效，不要返回。',
        `口味偏好：${tastePreference}`,
        `饮食偏好（软约束）：${dietPreferences.length ? dietPreferences.join('、') : '无特别偏好'}`,
        `可用厨具（软约束）：${cookwareNote || '按常见家用厨具处理'}`,
        `忌口食材（硬约束，必须严格避开）：${avoidances.length ? avoidances.join('、') : '无'}`,
        '规则：任何菜谱名称、食材列表、步骤、tips 中都不允许出现忌口食材或其同义表述。',
        `期望总烹饪时长（分钟）：${cookingTime}`,
        `食材：${ingredientText}`,
        `本次生成随机标识：${requestNonce || Date.now()}`,
        singleIngredientGuidance,
        '菜谱合理性要求（必须遵守）：',
        '1) 菜名必须是常见家常菜，不要生造菜名，不要出现明显违和组合（如“苹果炒土豆”）。',
        '2) 每道菜至少命中 1 种库存食材（库存优先）。',
        '3) 允许补充 1-3 种常见缺失食材来让菜谱成立（如“土豆炖牛肉”可补充牛肉）。',
        '4) 不要为了凑数量输出不符合常理的菜。',
        '5) 同一批结果要尽量多样：优先覆盖不同库存食材，不要多数菜都围绕同一个主食材。',
        '6) 菜名和做法不得语义重复，例如“白菜猪肉饺子”和“白菜猪肉馅饺子”属于同一道菜，只能保留一个。',
        'JSON 结构：',
        outputSchema,
        'difficulty 仅可取：简单、中等、困难。',
        summaryOnly ? '本次只生成列表摘要，不要返回 steps、tips、matchScore、nutrition 等详情字段。' : 'matchScore 范围 0-100。',
        '如果无法生成，返回 {"recipes":[]}',
      ].join('\n')
      let retryContent = ''
      let retryDashScopeMs = 0
      try {
        const retryStartedAt = Date.now()
        retryContent = await this.callDashScope(
          this.textModel,
          [
            { role: 'system', content: '你是结构化 JSON 菜谱生成助手。' },
            { role: 'user', content: retryPrompt },
          ],
          true,
          excludeNames.length ? 0.55 : 0.2,
          summaryOnly ? 900 : 2200,
        )
        retryDashScopeMs = Date.now() - retryStartedAt
      } catch (_) {
        this.logger.warn('DashScope retry generate-recipe failed, keep current generated recipes')
        retryContent = ''
      }
      if (retryDashScopeMs) {
        this.logger.log(
          `recipe-retry-stats remain=${remain}, ingredientCount=${pantryNames.length}, singleIngredient=${isSingleIngredientMode}, dashScopeMs=${retryDashScopeMs}`,
        )
      }
      const retryParsed = this.parseJson(retryContent)
      const retryList = this.pickRecipeArray(retryParsed)
      const retryNormalized = retryList
        .map((item: any, idx: number) => this.normalizeRecipe(item, recipes.length + idx, summaryOnly))
        .filter((x: GeneratedRecipe) => !!x.name && (summaryOnly || x.steps.length > 0))
      const retryDeduped = this.dedupeRecipesByName(retryNormalized)
      const retryRecipes = this.filterRecipesByAvoidances(retryDeduped, avoidances)
      removedByAvoidanceCount += Math.max(retryDeduped.length - retryRecipes.length, 0)
      const seen = new Set([
        ...excludeNames.map((x) => this.normalizeRecipeNameForDedupe(x)),
        ...recipes.map((x) => this.normalizeRecipeNameForDedupe(x.name)),
      ])
      for (const item of retryRecipes) {
        const key = this.normalizeRecipeNameForDedupe(item.name)
        if (!key || seen.has(key)) continue
        recipes.push(item)
        seen.add(key)
        if (recipes.length >= count) break
      }
    }
    if (!summaryOnly) recipes = this.diversifyRecipes(recipes, pantryNames, count)
    let finalRecipes = recipes.slice(0, count)
    if (!finalRecipes.length) {
      if (recipesBeforeAnyStrictFilter.length) {
        this.logger.warn(
          `Strict filters removed all AI recipes, fallback to unfiltered AI candidates. pantry=[${pantryNames.join(',')}]`,
        )
        finalRecipes = recipesBeforeAnyStrictFilter.slice(0, count)
      }
    }
    if (!finalRecipes.length) {
      const snippet = `${content || ''}`.replace(/\s+/g, ' ').slice(0, 180)
      this.logger.warn(
        `DashScope returned empty recipes after filtering, fallback to mock recipes. pantry=[${pantryNames.join(',')}], contentSnippet=${snippet}`,
      )
      if (!allowRecipeMockFallback) {
        throw new Error('AI 未生成可用菜谱，请重试')
      }
      const mocked = this.filterRecipesByAvoidances(this.mockRecipes(ingredients, count), avoidances)
        .map((item, idx) => this.normalizeRecipe(item, idx, summaryOnly))
      finalRecipes = mocked.slice(0, count)
    }
    finalRecipes = this.dedupeRecipesByName([...knowledgeRecipes, ...finalRecipes]).slice(0, count)
    profileApplied.generatedCount = finalRecipes.length
    profileApplied.removedByAvoidanceCount = removedByAvoidanceCount
    profileApplied.reducedByAvoidance = finalRecipes.length < count && removedByAvoidanceCount > 0
    this.logger.log(
      `recipe-generate-total requested=${count}, returned=${finalRecipes.length}, ingredientCount=${pantryNames.length}, singleIngredient=${isSingleIngredientMode}, totalMs=${Date.now() - startedAt}`,
    )
    return { recipes: finalRecipes, profileApplied }
  }

  async generateRecipeDetail(payload: any): Promise<GeneratedRecipe> {
    const summary = payload?.recipe && typeof payload.recipe === 'object' ? payload.recipe : payload || {}
    const name = `${summary?.name || ''}`.trim()
    if (!name) throw new Error('菜谱名称为空')

    const knowledgeRecipe = this.recipeKnowledge.findByIdOrName(summary?.knowledgeId || summary?.id || name)
      || this.recipeKnowledge.findByIdOrName(name)
    if (knowledgeRecipe) return this.knowledgeRecipeToGeneratedRecipe(knowledgeRecipe, false)

    const userId = Math.max(Number(payload?.userId || 1), 1)
    const profile = await this.loadUserProfileForRecipe(userId)
    const ingredients = Array.isArray(summary?.ingredients) ? summary.ingredients : []
    const ingredientText = ingredients
      .map((item: any) => `${item?.name || ''}${item?.quantity ?? ''}${item?.unit || ''}`.trim())
      .filter(Boolean)
      .join('、')
    const schema = '{"recipe":{"name":"菜名","duration":15,"difficulty":"简单","servings":2,"ingredients":[{"name":"番茄","quantity":2,"unit":"个"}],"steps":["具体步骤1","具体步骤2"],"tips":"烹饪提示","nutrition":{"calories":286,"protein":18.6,"fat":12.8,"carbohydrates":24.7,"fiber":3.2,"sodium":560,"analysis":"每人份营养特点简述"}}}'

    if (!this.apiKey) {
      if (!this.allowMockFallback) throw new Error('DASHSCOPE_API_KEY 未配置')
      return this.normalizeRecipe({
        ...summary,
        servings: 2,
        steps: ['准备并清洗所有食材。', '按菜式需要依次烹饪，调味后出锅。'],
        tips: '根据个人口味调整调味料用量。',
        nutrition: {
          calories: 280,
          protein: 16,
          fat: 12,
          carbohydrates: 28,
          fiber: 4,
          sodium: 520,
          analysis: '包含蛋白质和膳食纤维，建议搭配多样化蔬菜。',
        },
      }, 0, false)
    }

    const prompt = [
      '你是家庭烹饪与营养分析助手。仅返回 JSON，不要附带解释文本。',
      `请为菜谱“${name}”补全可直接照做的详细做法和每人份营养估算。`,
      `列表摘要食材：${ingredientText || '请按这道菜的常见做法补全'}`,
      `预计用时：${Math.max(Number(summary?.duration || 15), 1)} 分钟`,
      `难度：${summary?.difficulty || '简单'}`,
      `饮食偏好（尽量贴合）：${profile.dietPreferences.length ? profile.dietPreferences.join('、') : '无特别偏好'}`,
      `可用厨具：${profile.note || '常见家用厨具'}`,
      `忌口食材（绝对不能出现）：${profile.avoidances.length ? profile.avoidances.join('、') : '无'}`,
      '食材数量和单位必须明确，步骤必须具体，包含必要的火候和时间信息。',
      '必须严格沿用列表摘要中的食材，不得增加、删除或替换食材；所有文字必须使用简体中文，不得夹杂英文单词。',
      '描述油温时使用“油面微微发亮”“微微冒烟”等明确中文，不得使用 shimmer 等英文表达。',
      '营养数据按每人份估算，数值使用数字；热量单位 kcal，蛋白质/脂肪/碳水/膳食纤维单位 g，钠单位 mg。',
      '营养分析保持一句话，不要宣称治疗疾病或提供医学结论。',
      `JSON 结构：${schema}`,
    ].join('\n')

    const content = await this.callDashScope(
      this.textModel,
      [
        { role: 'system', content: '你是结构化 JSON 菜谱详情生成助手。' },
        { role: 'user', content: prompt },
      ],
      true,
      0.2,
      2200,
    )
    const parsed = this.parseJson(content)
    const list = this.pickRecipeArray(parsed)
    const detailSource = parsed?.recipe || list[0] || parsed
    const returnedIngredients = ingredients.length
      ? ingredients
      : (Array.isArray(detailSource?.ingredients) ? detailSource.ingredients : [])
    const recipe = this.normalizeRecipe({
      ...summary,
      ...(detailSource || {}),
      id: summary?.id || detailSource?.id,
      name,
      ingredients: returnedIngredients,
    }, 0, false)
    if (!recipe.steps.length) throw new Error('菜谱详情生成不完整，请重试')
    if (this.recipeContainsAvoidance(recipe, profile.avoidances)) throw new Error('生成内容包含忌口食材，请重试')
    return recipe
  }

  private normalizeRecipe(item: any, idx: number, summaryOnly = false): GeneratedRecipe {
    const steps = Array.isArray(item?.steps)
      ? item.steps.map((s: any) => `${s || ''}`.trim()).filter(Boolean)
      : []
    return {
      id: `${item?.id || `ai_${idx + 1}`}`,
      name: `${item?.name || ''}`.trim(),
      duration: Math.max(Number(item?.duration || 15), 1),
      difficulty: ['简单', '中等', '困难'].includes(`${item?.difficulty || ''}`)
        ? `${item.difficulty}`
        : '简单',
      matchScore: summaryOnly ? undefined : Math.max(0, Math.min(100, Number(item?.matchScore || 85))),
      coverImage: `${item?.coverImage || ''}`,
      ingredients: Array.isArray(item?.ingredients)
        ? item.ingredients
            .map((x: any) => ({
              name: `${x?.name || ''}`.trim(),
              quantity: Number.isFinite(Number(x?.quantity)) ? Number(x.quantity) : undefined,
              unit: `${x?.unit || ''}`.trim(),
            }))
            .filter((x: any) => !!x.name)
        : [],
      steps: summaryOnly ? [] : steps,
      tips: summaryOnly ? '' : `${item?.tips || ''}`.trim(),
      servings: summaryOnly ? undefined : Math.max(1, Math.min(12, Number(item?.servings || 2))),
      nutrition: summaryOnly ? undefined : this.normalizeRecipeNutrition(item?.nutrition),
      detailReady: !summaryOnly && steps.length > 0,
    }
  }

  getRecipeKnowledgeStatus() {
    return this.recipeKnowledge.getStatus()
  }

  private knowledgeHitToGeneratedRecipe(hit: RecipeKnowledgeHit, summaryOnly: boolean) {
    return {
      ...this.knowledgeRecipeToGeneratedRecipe(hit.recipe, summaryOnly),
      matchScore: hit.score,
      retrievalSource: hit.retrievalMode,
      matchedIngredients: hit.matchedIngredients,
      missingIngredients: hit.missingIngredients,
    }
  }

  private knowledgeRecipeToGeneratedRecipe(recipe: RecipeKnowledgeDocument, summaryOnly: boolean): GeneratedRecipe {
    const nutrition = recipe.nutritionPerServing
      ? {
          calories: recipe.nutritionPerServing.calories,
          protein: recipe.nutritionPerServing.protein,
          fat: recipe.nutritionPerServing.fat,
          carbohydrates: recipe.nutritionPerServing.carbohydrates,
          fiber: recipe.nutritionPerServing.fiber,
          sodium: recipe.nutritionPerServing.sodium,
          analysis: recipe.nutritionPerServing.estimated ? '每人份估算值，仅用于日常饮食参考。' : '每人份营养数据。',
        }
      : undefined
    return {
      id: recipe.id,
      knowledgeId: recipe.id,
      name: recipe.name,
      duration: recipe.durationMinutes,
      difficulty: recipe.difficulty,
      matchScore: 85,
      coverImage: '',
      ingredients: recipe.ingredients.map((item) => ({
        name: item.name,
        quantity: item.quantity === null ? undefined : item.quantity,
        unit: item.unit,
      })),
      steps: summaryOnly ? [] : recipe.steps.map((step) => step.description),
      tips: summaryOnly ? '' : recipe.tips.join('；'),
      servings: summaryOnly ? undefined : recipe.servings,
      nutrition: summaryOnly ? undefined : nutrition,
      detailReady: true,
      retrievalSource: 'knowledge-base',
    }
  }

  private normalizeRecipeNutrition(source: any): RecipeNutrition | undefined {
    if (!source || typeof source !== 'object') return undefined
    const number = (value: unknown, max: number) => Math.max(0, Math.min(max, Number(value || 0)))
    const nutrition: RecipeNutrition = {
      calories: number(source.calories ?? source.kcal ?? source.energy, 5000),
      protein: number(source.protein, 500),
      fat: number(source.fat, 500),
      carbohydrates: number(source.carbohydrates ?? source.carbs, 1000),
      fiber: number(source.fiber ?? source.dietaryFiber, 200),
      sodium: number(source.sodium, 20000),
      analysis: `${source.analysis || ''}`.trim(),
    }
    const hasValue = Object.entries(nutrition).some(([key, value]) => key !== 'analysis' && Number(value) > 0)
    return hasValue ? nutrition : undefined
  }

  private normalizeStringArray(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.map((x) => `${x || ''}`.trim()).filter(Boolean)
  }

  private async loadUserProfileForRecipe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        note: true,
        dietPreferences: true,
        avoidances: true,
      },
    })
    if (!user) {
      return { note: '', dietPreferences: [] as string[], avoidances: [] as string[] }
    }
    return {
      note: `${user.note || ''}`.trim(),
      dietPreferences: this.normalizeStringArray(user.dietPreferences),
      avoidances: this.normalizeStringArray(user.avoidances),
    }
  }

  private normalizeTextForCompare(text: unknown) {
    return `${text || ''}`.trim().replace(/\s+/g, '').toLowerCase()
  }

  private normalizeRecipeNameForDedupe(text: unknown) {
    return this.normalizeTextForCompare(text)
      .replace(/馅(?=饺子)/g, '')
      .replace(/水饺/g, '饺子')
  }

  private recipeContainsAvoidance(recipe: GeneratedRecipe, avoidances: string[]) {
    if (!avoidances.length) return false
    const haystack = [
      recipe.name,
      ...(Array.isArray(recipe.ingredients) ? recipe.ingredients.map((x) => x?.name || '') : []),
      ...(Array.isArray(recipe.steps) ? recipe.steps : []),
      recipe.tips || '',
    ]
      .join(' ')
      .replace(/\s+/g, '')
      .toLowerCase()
    return avoidances.some((x) => {
      const key = this.normalizeTextForCompare(x)
      return key && haystack.includes(key)
    })
  }

  private filterRecipesByAvoidances(recipes: GeneratedRecipe[], avoidances: string[]) {
    const list = Array.isArray(recipes) ? recipes : []
    if (!avoidances.length) return list
    return list.filter((item) => !this.recipeContainsAvoidance(item, avoidances))
  }

  private dedupeRecipesByName(recipes: GeneratedRecipe[]) {
    const list = Array.isArray(recipes) ? recipes : []
    const seen = new Set<string>()
    const output: GeneratedRecipe[] = []
    for (const item of list) {
      const key = this.normalizeRecipeNameForDedupe(item?.name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      output.push(item)
    }
    return output
  }

  private diversifyRecipes(recipes: GeneratedRecipe[], pantryNames: string[], count: number) {
    const list = Array.isArray(recipes) ? recipes.filter((x) => !!x?.name) : []
    if (!list.length || count <= 1) return list
    const pantryKeys = this.collectPantryDiversityKeys(pantryNames)
    if (pantryKeys.length <= 1) return list

    const sorted = list.slice().sort((a, b) => Number(b?.matchScore || 0) - Number(a?.matchScore || 0))
    const chosen: GeneratedRecipe[] = []
    const chosenNameSet = new Set<string>()
    const primaryUsage = new Map<string, number>()
    const seenPrimaryCovered = new Set<string>()
    const maxPerPrimary = Math.max(1, Math.ceil(count / Math.min(pantryKeys.length, 3)))

    // Pass 1: try to cover different pantry ingredients first.
    for (const item of sorted) {
      if (chosen.length >= count) break
      const recipeKey = this.normalizeRecipeNameForDedupe(item.name)
      if (!recipeKey || chosenNameSet.has(recipeKey)) continue
      const primary = this.pickPrimaryPantryKey(item, pantryKeys)
      if (!primary || seenPrimaryCovered.has(primary)) continue
      chosen.push(item)
      chosenNameSet.add(recipeKey)
      seenPrimaryCovered.add(primary)
      primaryUsage.set(primary, 1)
    }

    // Pass 2: fill rest while preventing one primary ingredient from dominating.
    for (const item of sorted) {
      if (chosen.length >= count) break
      const recipeKey = this.normalizeRecipeNameForDedupe(item.name)
      if (!recipeKey || chosenNameSet.has(recipeKey)) continue
      const primary = this.pickPrimaryPantryKey(item, pantryKeys)
      if (primary) {
        const used = Number(primaryUsage.get(primary) || 0)
        if (used >= maxPerPrimary) continue
        primaryUsage.set(primary, used + 1)
      }
      chosen.push(item)
      chosenNameSet.add(recipeKey)
    }

    // Pass 3: if still not enough, append any remaining candidates.
    if (chosen.length < count) {
      for (const item of sorted) {
        if (chosen.length >= count) break
        const recipeKey = this.normalizeRecipeNameForDedupe(item.name)
        if (!recipeKey || chosenNameSet.has(recipeKey)) continue
        chosen.push(item)
        chosenNameSet.add(recipeKey)
      }
    }

    return chosen.length ? chosen : sorted
  }

  private collectPantryDiversityKeys(names: string[]) {
    const list = Array.isArray(names) ? names : []
    const keys = new Set<string>()
    for (const name of list) {
      const raw = `${name || ''}`.trim()
      if (!raw) continue
      const canonical = this.canonicalizeIngredientName(raw)
      const normalizedRaw = this.normalizeIngredientTextForMatch(raw)
      const normalizedCanonical = this.normalizeIngredientTextForMatch(canonical)
      if (normalizedRaw.length >= 2) keys.add(normalizedRaw)
      if (normalizedCanonical.length >= 2) keys.add(normalizedCanonical)
    }
    return Array.from(keys)
  }

  private pickPrimaryPantryKey(recipe: GeneratedRecipe, pantryKeys: string[]) {
    const keys = Array.isArray(pantryKeys) ? pantryKeys : []
    if (!keys.length) return ''
    const nameText = this.normalizeIngredientTextForMatch(`${recipe?.name || ''}`)
    for (const key of keys) {
      if (key && nameText.includes(key)) return key
    }
    const ingredientText = this.normalizeIngredientTextForMatch(
      Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((x) => `${x?.name || ''}`).join(' ') : '',
    )
    for (const key of keys) {
      if (key && ingredientText.includes(key)) return key
    }
    const allText = this.normalizeIngredientTextForMatch(
      [
        `${recipe?.name || ''}`,
        ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((x) => `${x?.name || ''}`) : []),
        ...(Array.isArray(recipe?.steps) ? recipe.steps.map((x) => `${x || ''}`) : []),
      ].join(' '),
    )
    for (const key of keys) {
      if (key && allText.includes(key)) return key
    }
    return ''
  }

  private pickRecipeArray(parsed: any): any[] {
    if (!parsed) return []
    if (Array.isArray(parsed)) return parsed

    const directKeys = [
      'recipes',
      'list',
      'items',
      'data',
      'result',
      'output',
      'dishes',
      '菜谱',
      '菜谱列表',
    ]
    for (const key of directKeys) {
      if (Array.isArray(parsed?.[key])) return parsed[key]
      if (parsed?.[key] && Array.isArray(parsed[key]?.recipes)) return parsed[key].recipes
    }

    const deep = this.findRecipeArrayDeep(parsed, 0)
    return Array.isArray(deep) ? deep : []
  }

  private findRecipeArrayDeep(node: any, depth: number): any[] {
    if (!node || depth > 4) return []
    if (Array.isArray(node)) {
      const valid = node.some((item) => {
        const name = `${item?.name || item?.title || item?.菜名 || ''}`.trim()
        const steps = Array.isArray(item?.steps) ? item.steps : item?.步骤
        return !!name || Array.isArray(steps)
      })
      return valid ? node : []
    }
    if (typeof node !== 'object') return []
    const keys = Object.keys(node)
    for (const key of keys) {
      const child = node[key]
      const found = this.findRecipeArrayDeep(child, depth + 1)
      if (found.length) return found
    }
    return []
  }

  private recipeUsesPantryIngredients(recipe: GeneratedRecipe, pantryNames: string[]) {
    const names = Array.isArray(pantryNames) ? pantryNames : []
    if (!names.length) return true
    const haystackRaw = [
      `${recipe?.name || ''}`,
      ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((x) => `${x?.name || ''}`) : []),
      ...(Array.isArray(recipe?.steps) ? recipe.steps.map((x) => `${x || ''}`) : []),
    ].join(' ')
    const haystack = this.normalizeIngredientTextForMatch(haystackRaw)
    const pantryKeys = this.collectIngredientMatchKeys(names)
    return pantryKeys.some((key) => key && haystack.includes(key))
  }

  private collectIngredientMatchKeys(names: string[]) {
    const list = Array.isArray(names) ? names : []
    const reverseAliasMap = Object.keys(this.ingredientAliasMap).reduce((acc, key) => {
      const value = `${this.ingredientAliasMap[key] || ''}`.trim()
      if (!value) return acc
      if (!acc[value]) acc[value] = []
      acc[value].push(key)
      return acc
    }, {} as Record<string, string[]>)
    const keys = new Set<string>()
    for (const name of list) {
      const raw = `${name || ''}`.trim()
      if (!raw) continue
      const directAlias = `${this.ingredientAliasMap[raw] || ''}`.trim()
      const reverseAlias = Array.isArray(reverseAliasMap[raw]) ? reverseAliasMap[raw] : []
      const candidates = [raw, directAlias, ...reverseAlias].filter(Boolean)
      for (const candidate of candidates) {
        const normalized = this.normalizeIngredientTextForMatch(candidate)
        if (normalized.length >= 2) keys.add(normalized)
      }
    }
    return Array.from(keys)
  }

  private async callDashScope(
    model: string,
    messages: any[],
    forceJson = false,
    temperature = 0.2,
    maxTokens = 800,
  ): Promise<string> {
    const modelName = `${model || ''}`.toLowerCase()
    const isAsrModel = modelName.includes('asr')
    if (isAsrModel) {
      const response = await this.callDashScopeAsr(model, messages)
      return this.extractMessageText(
        response?.output?.choices?.[0]?.message?.content || response?.choices?.[0]?.message?.content,
      )
    }

    const body: any = {
      model,
      messages,
      temperature: Math.max(0, Math.min(1.2, Number(temperature || 0.2))),
      max_tokens: Math.max(256, Math.min(4096, Number(maxTokens || 800))),
    }
    if (forceJson) {
      body.response_format = { type: 'json_object' }
    }
    const hasVisualInput = messages.some((message: any) =>
      Array.isArray(message?.content) && message.content.some((part: any) => part?.type === 'image_url'),
    )
    if (hasVisualInput && /^(qwen3\.6|qwen3\.5|qwen3-vl)/.test(modelName)) {
      body.enable_thinking = false
    }

    const response = await this.postDashScopeJson(this.endpoint, body)
    return this.extractMessageText(response?.choices?.[0]?.message?.content)
  }

  private async callDashScopeAsr(model: string, messages: any[]) {
    const body = {
      model,
      input: {
        messages: this.toDashScopeAsrMessages(messages),
      },
      parameters: {
        asr_options: {
          enable_itn: false,
          language: 'zh',
        },
      },
    }
    return this.postDashScopeJson(this.asrEndpoint, body)
  }

  private toDashScopeAsrMessages(messages: any[]) {
    return (Array.isArray(messages) ? messages : []).map((msg: any) => {
      const role = `${msg?.role || 'user'}`
      const content = msg?.content
      if (Array.isArray(content)) {
        const normalized = content
          .map((part: any) => {
            if (part?.type === 'input_audio') {
              const audio = `${part?.input_audio?.data || part?.input_audio?.url || part?.audio || ''}`.trim()
              return audio ? { audio } : null
            }
            if (part?.type === 'text') {
              const text = `${part?.text || ''}`.trim()
              return text ? { text } : null
            }
            if (part?.audio) {
              const audio = `${part.audio || ''}`.trim()
              return audio ? { audio } : null
            }
            if (part?.text) {
              const text = `${part.text || ''}`.trim()
              return text ? { text } : null
            }
            return null
          })
          .filter(Boolean)
        if (normalized.length) return { role, content: normalized }
      }
      const text = `${content || ''}`.trim()
      return { role, content: text ? [{ text }] : [{ text: '' }] }
    })
  }

  private async postDashScopeJson(url: string, body: any) {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      })
    } catch (error: any) {
      const detail = error?.cause?.code || error?.cause?.message || error?.message || 'unknown'
      throw new Error(`DashScope 网络请求失败: ${detail}`)
    }

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const msg =
        payload?.error?.message ||
        payload?.message ||
        payload?.output?.message ||
        `DashScope request failed: ${response.status}`
      throw new Error(msg)
    }
    return payload
  }

  private extractMessageText(content: any): string {
    if (!content) return ''
    if (typeof content === 'string') return content.trim()
    if (Array.isArray(content)) {
      const text = content
        .map((part: any) => {
          if (typeof part === 'string') return part
          if (typeof part?.text === 'string') return part.text
          if (typeof part?.content === 'string') return part.content
          return ''
        })
        .filter(Boolean)
        .join('\n')
      return text.trim()
    }
    if (typeof content?.text === 'string') return content.text.trim()
    return ''
  }

  private parseJson(raw: string): any {
    if (!raw) return {}
    const direct = this.tryParseJson(raw)
    if (direct && (Array.isArray(direct) || typeof direct === 'object')) return direct

    const block =
      raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ||
      raw.match(/```[\s\S]*?```/i)?.[0]?.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim() ||
      raw.match(/\{[\s\S]*\}/)?.[0] ||
      raw.match(/\[[\s\S]*\]/)?.[0]
    if (!block) return {}

    const parsedBlock = this.tryParseJson(block)
    if (parsedBlock && (Array.isArray(parsedBlock) || typeof parsedBlock === 'object')) return parsedBlock

    const repaired = this.tryRepairJson(block)
    const parsedRepaired = this.tryParseJson(repaired)
    if (parsedRepaired && (Array.isArray(parsedRepaired) || typeof parsedRepaired === 'object')) return parsedRepaired
    return {}
  }

  private tryParseJson(text: string): any {
    try {
      return JSON.parse(`${text || ''}`.trim())
    } catch (_) {
      return null
    }
  }

  private tryRepairJson(text: string): string {
    const src = `${text || ''}`.trim()
    if (!src) return ''
    let body = src
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u0000-\u001f]/g, ' ')
      .trim()
    const firstBrace = body.indexOf('{')
    const firstBracket = body.indexOf('[')
    let start = -1
    if (firstBrace >= 0 && firstBracket >= 0) start = Math.min(firstBrace, firstBracket)
    else start = Math.max(firstBrace, firstBracket)
    if (start > 0) body = body.slice(start)
    const stack: string[] = []
    let inString = false
    let escaped = false
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '{') stack.push('}')
      else if (ch === '[') stack.push(']')
      else if ((ch === '}' || ch === ']') && stack.length && stack[stack.length - 1] === ch) stack.pop()
    }
    while (stack.length) body += stack.pop()
    return body
  }

  private parseRecipeArrayFallback(content: string): any[] {
    const text = `${content || ''}`.trim()
    if (!text) return []
    const recipesKey = text.search(/"recipes"\s*:/)
    if (recipesKey < 0) return []
    const bracketStart = text.indexOf('[', recipesKey)
    if (bracketStart < 0) return []
    const arrText = this.pickBalancedArrayText(text, bracketStart)
    if (!arrText) return []
    const repairedArray = this.tryRepairJson(arrText)
    const parsedArray = this.tryParseJson(repairedArray)
    if (Array.isArray(parsedArray)) return parsedArray
    const wrapped = this.tryParseJson(`{"recipes":${repairedArray}}`)
    return Array.isArray(wrapped?.recipes) ? wrapped.recipes : []
  }

  private pickBalancedArrayText(text: string, from: number): string {
    const src = `${text || ''}`
    if (!src || from < 0 || src[from] !== '[') return ''
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = from; i < src.length; i += 1) {
      const ch = src[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '[') depth += 1
      if (ch === ']') depth -= 1
      if (depth === 0) return src.slice(from, i + 1)
    }
    return src.slice(from)
  }

  private inferAudioFormat(mimeType: unknown, fileName: unknown) {
    const mime = `${mimeType || ''}`.toLowerCase()
    const name = `${fileName || ''}`.toLowerCase()
    if (mime.includes('wav') || name.endsWith('.wav')) return 'wav'
    if (mime.includes('aac') || name.endsWith('.aac')) return 'aac'
    if (mime.includes('mpeg') || mime.includes('mp3') || name.endsWith('.mp3')) return 'mp3'
    if (mime.includes('webm') || name.endsWith('.webm')) return 'webm'
    if (mime.includes('m4a') || mime.includes('mp4') || name.endsWith('.m4a')) return 'm4a'
    return 'mp3'
  }

  private inferAudioMimeType(mimeType: unknown, fileName: unknown) {
    const mime = `${mimeType || ''}`.toLowerCase().trim()
    const name = `${fileName || ''}`.toLowerCase()
    if (mime === 'audio/mpeg' || mime === 'audio/mp3' || name.endsWith('.mp3')) return 'audio/mpeg'
    if (mime === 'audio/wav' || mime === 'audio/x-wav' || name.endsWith('.wav')) return 'audio/wav'
    if (mime === 'audio/webm' || name.endsWith('.webm')) return 'audio/webm'
    if (mime === 'audio/aac' || name.endsWith('.aac')) return 'audio/aac'
    if (mime === 'audio/mp4' || mime === 'audio/x-m4a' || name.endsWith('.m4a')) return 'audio/mp4'
    return 'audio/mpeg'
  }

  private normalizeAssistantCommand(source: any, transcript: string): AssistantCommand {
    const allowedIntents = new Set<AssistantIntent>([
      'inventory_add',
      'inventory_consume',
      'inventory_read',
      'expiry_read',
      'recipe_request',
      'unknown',
    ])
    const rawIntent = `${source?.intent || ''}`.trim() as AssistantIntent
    const intent = allowedIntents.has(rawIntent) ? rawIntent : this.detectAssistantIntent(transcript)
    const items = (Array.isArray(source?.items) ? source.items : [])
      .map((item: any) => {
        const name = this.canonicalizeIngredientName(this.cleanIngredientName(`${item?.name || ''}`))
        const quantityValue = Number(item?.quantity)
        const rawCategory = `${item?.category || ''}`.trim()
        return {
          name,
          quantity: Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : undefined,
          unit: `${item?.unit || ''}`.trim() || undefined,
          category: this.validCategories.has(rawCategory) ? rawCategory : undefined,
          location: `${item?.location || ''}`.trim() || undefined,
          expireDate: `${item?.expireDate || ''}`.trim() || undefined,
        }
      })
      .filter((item) => !!item.name)
    const recipeIngredients = Array.isArray(source?.recipe?.ingredients)
      ? source.recipe.ingredients.map((name: any) => `${name || ''}`.trim()).filter(Boolean)
      : []
    const maxDuration = Number(source?.recipe?.maxDuration)
    const confidenceValue = Number(source?.confidence)
    const command: AssistantCommand = {
      intent,
      transcript,
      items,
      query: {
        target: `${source?.query?.target || ''}`.trim() || undefined,
        scope: `${source?.query?.scope || ''}`.trim() || undefined,
        location: `${source?.query?.location || ''}`.includes('冷冻')
          ? '冷冻'
          : (`${source?.query?.location || ''}`.includes('冷藏') ? '冷藏' : undefined),
      },
      recipe: {
        ingredients: recipeIngredients,
        maxDuration: Number.isFinite(maxDuration) && maxDuration > 0 ? maxDuration : undefined,
        difficulty: `${source?.recipe?.difficulty || ''}`.trim() || undefined,
        taste: `${source?.recipe?.taste || ''}`.trim() || undefined,
      },
      reply: `${source?.reply || ''}`.trim(),
      confidence: Number.isFinite(confidenceValue)
        ? Number(Math.max(0, Math.min(1, confidenceValue)).toFixed(2))
        : 0.7,
      requiresConfirmation: intent === 'inventory_add' || intent === 'inventory_consume',
    }
    if (!command.reply) command.reply = this.buildAssistantReply(command)
    return command
  }

  private buildAssistantCommandFallback(transcript: string): AssistantCommand {
    const intent = this.detectAssistantIntent(transcript)
    const fallback = this.parseVoiceTextFallback(
      `${transcript || ''}`
        .replace(/(请|帮我|我要|想要|一下|今天|刚才|刚刚|已经|冰箱里|库存里|入库|添加|新增|放进去|放进冰箱|买了|买回|取出|拿出|用了|用掉|吃了|吃掉|喝了|喝掉|查询|查看|朗读|读一下|告诉我|推荐|生成|一道|菜谱)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    const parsedItems = Array.isArray(fallback.items) ? fallback.items : []
    const items = (parsedItems.length ? parsedItems : (fallback.name ? [fallback] : []))
      .map((item: any) => ({
        name: `${item?.name || ''}`.trim(),
        quantity: item?.quantity,
        unit: `${item?.unit || ''}`.trim() || undefined,
      }))
      .filter((item) => !!item.name)
    const inventoryTargetMatch = transcript.match(
      /(?:查一下|查查|查询|查看|告诉我)?\s*([^，。！？?\s]{1,12}?)(?:还有多少|还剩多少|剩多少|有多少)/,
    )
    const inventoryTargetAfterMatch = transcript.match(
      /(?:还有|还剩|剩下|有)\s*(?:多少|几个|几颗|几盒|几袋|几瓶|几份)\s*([^，。！？?\s]{1,12})/,
    )
    const inventoryTarget = `${inventoryTargetMatch?.[1] || inventoryTargetAfterMatch?.[1] || ''}`
      .replace(/^(冰箱里|库存里|冰箱|库存)/, '')
      .replace(/(呢|吗|呀|啊)$/, '')
      .trim()
    const inventoryLocation = transcript.includes('冷冻')
      ? '冷冻'
      : (transcript.includes('冷藏') ? '冷藏' : undefined)
    const expiryTargetMatch = transcript.match(
      /(?:查一下|查查|查询|查看|告诉我)?\s*([^，。！？?\s]{1,12}?)(?:什么时候过期|多久过期|快过期了吗|是否过期)/,
    )
    const expiryTarget = `${expiryTargetMatch?.[1] || ''}`
      .replace(/^(冰箱里|库存里|冰箱|库存)/, '')
      .trim()
    const recipeIngredientMatch = transcript.match(
      /(?:用|拿)\s*(.+?)\s*(?:做|推荐|生成|来一道|来个)/,
    )
    const recipeIngredientText = `${recipeIngredientMatch?.[1] || ''}`.trim()
    const recipeIngredients = recipeIngredientText
      ? recipeIngredientText.split(/[、，,和与跟及+\s]+/).map((name) => name.trim()).filter(Boolean)
      : []
    const durationMatch = transcript.match(/(\d+)\s*分钟/)
    const maxDuration = Number(durationMatch?.[1])
    const difficulty = ['简单', '中等', '困难'].find((value) => transcript.includes(value))
    const taste = ['清淡', '香辣', '麻辣', '酸甜', '咸鲜'].find((value) => transcript.includes(value))
    const command: AssistantCommand = {
      intent,
      transcript,
      items: intent === 'inventory_add' || intent === 'inventory_consume' ? items : [],
      query: {
        target: intent === 'inventory_read'
          ? (inventoryTarget || undefined)
          : (intent === 'expiry_read' ? (expiryTarget || undefined) : undefined),
        scope: intent === 'expiry_read' ? 'expiring' : (intent === 'inventory_read' ? 'all' : undefined),
        location: intent === 'inventory_read' ? inventoryLocation : undefined,
      },
      recipe: {
        ingredients: intent === 'recipe_request' ? recipeIngredients : [],
        maxDuration: intent === 'recipe_request' && Number.isFinite(maxDuration) && maxDuration > 0
          ? maxDuration
          : undefined,
        difficulty: intent === 'recipe_request' ? difficulty : undefined,
        taste: intent === 'recipe_request' ? taste : undefined,
      },
      reply: '',
      confidence: intent === 'unknown' ? 0.2 : 0.55,
      requiresConfirmation: intent === 'inventory_add' || intent === 'inventory_consume',
    }
    command.reply = this.buildAssistantReply(command)
    return command
  }

  private detectAssistantIntent(text: string): AssistantIntent {
    const value = `${text || ''}`.replace(/\s+/g, '')
    if (!value) return 'unknown'
    if (/(临期|快过期|即将过期|已经过期|过期食材|什么时候过期|多久过期|是否过期)/.test(value)) return 'expiry_read'
    if (/(菜谱|做什么菜|吃什么|推荐.*菜|怎么做)/.test(value)) return 'recipe_request'
    if (/(取出|拿出|出库|用了|用掉|吃了|吃掉|喝了|喝掉|喝完|吃完|用完|减掉|扣掉)/.test(value)) {
      return 'inventory_consume'
    }
    if (/(入库|添加|新增|放进去|放进冰箱|买了|买回|存入)/.test(value)) return 'inventory_add'
    if (/(库存|冰箱里有什么|还有什么|剩多少|有多少|还有几个|还剩几个|冷藏区|冷冻区|朗读|读一下|告诉我.*食材)/.test(value)) {
      return 'inventory_read'
    }
    return 'unknown'
  }

  private buildAssistantReply(command: AssistantCommand) {
    const names = command.items.map((item) => {
      const amount = item.quantity ? `${item.quantity}${item.unit || ''}` : ''
      return `${item.name}${amount}`
    }).join('、')
    if (command.intent === 'inventory_add') return names ? `我识别到准备入库：${names}，请确认信息。` : '我听到了入库需求，请补充食材信息。'
    if (command.intent === 'inventory_consume') return names ? `我识别到准备取出：${names}，请确认数量。` : '我听到了出库需求，请补充食材和数量。'
    if (command.intent === 'inventory_read') return '我识别到库存查询需求，下一步将读取冰箱库存。'
    if (command.intent === 'expiry_read') return '我识别到临期食材查询需求，下一步将读取临期库存。'
    if (command.intent === 'recipe_request') return '我识别到菜谱推荐需求，下一步将根据条件生成菜谱。'
    return '我还不能确定你的指令，请换一种说法再试一次。'
  }

  private parseVoiceTextFallback(text: string) {
    const cleaned = `${text || ''}`
      .replace(/[，,。；;！!？?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) {
      return {
        name: '',
        quantity: undefined as number | undefined,
        unit: '',
        items: [] as Array<{ name: string; quantity?: number; unit?: string }>,
      }
    }
    const multiItems = this.parseMultiVoiceItems(cleaned)
    const parsedSingle = this.parseVoiceSingleItem(cleaned)
    if (!parsedSingle?.name) {
      return {
        name: cleaned,
        quantity: undefined as number | undefined,
        unit: '',
        items: multiItems,
      }
    }
    return {
      name: parsedSingle.name,
      quantity: parsedSingle.quantity,
      unit: parsedSingle.unit || '',
      items: multiItems,
    }
  }

  private parseMultiVoiceItems(text: string) {
    const parts = `${text || ''}`
      .split(/(?:然后|再|还有|和|跟|并且|并|、|,|，|;|；)/)
      .map((x) => x.trim())
      .filter(Boolean)
    const list = parts
      .map((part) => {
        const parsed = this.parseVoiceSingleItem(part)
        if (!parsed.name) return { name: part }
        return parsed
      })
      .filter((x) => !!`${x?.name || ''}`.trim())
    return list
  }

  private parseVoiceSingleItem(text: string) {
    const cleaned = `${text || ''}`
      .replace(/^(今天|刚才|刚刚|已经|我)\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) return { name: '', quantity: undefined as number | undefined, unit: undefined as string | undefined }
    const unitPattern = '(个|颗|斤|公斤|千克|克|袋|包|瓶|盒|罐|把|根|条|片|块|份|毫升|升)'
    const qtyPattern = '([零一二两三四五六七八九十百千万\\d]+(?:\\.\\d+)?)'
    // 名称在前：番茄两个 / 番茄 2 个
    const nameFirst = cleaned.match(
      new RegExp(`^([\\u4e00-\\u9fa5A-Za-z]+?)\\s*${qtyPattern}?\\s*${unitPattern}?$`),
    )
    if (nameFirst) {
      const [, rawName = '', rawQty = '', rawUnit = ''] = nameFirst
      return {
        name: this.cleanVoiceName(rawName),
        quantity: this.normalizeVoiceQuantity(rawQty),
        unit: rawUnit.trim() || undefined,
      }
    }
    // 数量在前：两个番茄 / 2个土豆
    const qtyFirst = cleaned.match(
      new RegExp(`^${qtyPattern}\\s*${unitPattern}?\\s*([\\u4e00-\\u9fa5A-Za-z]+)$`),
    )
    if (qtyFirst) {
      const [, rawQty = '', rawUnit = '', rawName = ''] = qtyFirst
      return {
        name: this.cleanVoiceName(rawName),
        quantity: this.normalizeVoiceQuantity(rawQty),
        unit: rawUnit.trim() || undefined,
      }
    }
    return {
      name: this.cleanVoiceName(cleaned),
      quantity: undefined as number | undefined,
      unit: undefined as string | undefined,
    }
  }

  private cleanVoiceName(raw: string) {
    return `${raw || ''}`
      .replace(/\s+/g, '')
      .replace(/(放在|放到|放进|放入|存到|存入|放至|存至|冻起来|冻上|放冰箱|冰箱里|冷藏室|冷藏层|冷冻室|冷冻层|冷冻柜|保鲜层)$/g, '')
      .replace(/(放冷藏|放冷冻)$/g, '')
      .replace(/([零一二两三四五六七八九十百千万\d]+)(放|存|冻)$/g, '')
      .replace(/(放|存|冻)$/g, '')
      .trim()
  }

  private normalizeVoiceQuantity(value: unknown) {
    if (value === undefined || value === null || `${value}`.trim() === '') return undefined
    const text = `${value}`.trim()
    const num = Number(text)
    if (Number.isFinite(num) && num > 0) return Number(num)
    const table: Record<string, number> = {
      零: 0,
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    }
    if (text.length === 1 && table[text] !== undefined) return table[text]
    if (text === '十一') return 11
    if (text === '十二') return 12
    if (text === '十三') return 13
    if (text === '十四') return 14
    if (text === '十五') return 15
    if (text === '十六') return 16
    if (text === '十七') return 17
    if (text === '十八') return 18
    if (text === '十九') return 19
    if (text === '二十') return 20
    return undefined
  }

  private normalizeVoiceItems(
    modelItems: any[],
    fallbackItems: Array<{ name: string; quantity?: number; unit?: string }>,
    single: { name: string; quantity?: number; unit?: string },
  ) {
    const source = Array.isArray(modelItems) && modelItems.length ? modelItems : fallbackItems
    const normalized = source
      .map((x) => {
        const parsedName = this.parseVoiceSingleItem(`${x?.name || ''}`)
        const rawCategory = `${x?.category || ''}`.trim()
        const category = this.validCategories.has(rawCategory)
          ? rawCategory
          : this.inferCategoryByName(parsedName.name)
        return {
          name: parsedName.name,
          quantity: this.normalizeVoiceQuantity(x?.quantity ?? parsedName.quantity),
          unit: `${x?.unit || parsedName.unit || ''}`.trim() || undefined,
          category: category || undefined,
        }
      })
      .filter((x) => !!x.name)
    if (normalized.length) return normalized
    if (!single.name) return []
    return [
      {
        name: single.name,
        quantity: this.normalizeVoiceQuantity(single.quantity),
        unit: `${single.unit || ''}`.trim() || undefined,
        category: this.inferCategoryByName(single.name) || undefined,
      },
    ]
  }

  private extractIngredientsFromResponse(content: string): RecognizedIngredient[] {
    const parsed = this.parseJson(content)
    const structuredList = this.pickIngredientArray(parsed)
    const fallbackList = this.parseIngredientsFallback(content)
    const mergedList = [...(Array.isArray(structuredList) ? structuredList : []), ...(Array.isArray(fallbackList) ? fallbackList : [])]

    const normalized = mergedList
      .map((item: any) => this.normalizeRecognizedIngredient(item))
      .filter((x: RecognizedIngredient) => !!x.name && !this.isNoiseIngredientName(x.name))

    const seen = new Set<string>()
    return normalized.filter((item) => {
      const key = item.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private async runIngredientEnhancePass(dataUrl: string): Promise<RecognizedIngredient[]> {
    try {
      const prompt = [
        '请对同一张食材图片进行第二轮补充识别，只返回 JSON。',
        '目标：尽可能识别完整，尤其补充第一眼容易漏掉的小食材、边缘食材和包装内食材。',
        '如果不确定，也可以低置信度返回，不要只给4条左右结果。',
        'JSON 结构：{"ingredients":[{"name":"食材名","category":"类别","quantity":3,"unit":"个","confidence":0.75}]}',
        'category 仅可取：水果、蔬菜、肉类、蛋奶、海鲜、饮料、调味品、其他。',
        'quantity 和 unit 必须返回；可数食材按可见数量逐个计数，成把或包装食材使用“把”“袋”“盒”“份”等单位。',
        '若确实无法识别，返回 {"ingredients":[]}',
      ].join('\n')
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是食材识别补充助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.45,
        600,
      )
      return this.extractIngredientsFromResponse(content)
    } catch (_) {
      return []
    }
  }

  private async runReceiptEnhancePass(dataUrl: string): Promise<RecognizedIngredient[]> {
    try {
      const prompt = [
        '请对同一张购物小票进行第二轮补充识别，只返回 JSON。',
        '目标：尽量补全更多可入库食材条目，不要只返回4条左右。',
        '优先识别商品名为食材/食品的行，忽略金额、时间、门店、合计等信息。',
        'JSON 结构：{"ingredients":[{"name":"食材名","category":"类别","quantity":2,"unit":"个","confidence":0.75}]}',
        'category 仅可取：水果、蔬菜、肉类、蛋奶、海鲜、饮料、调味品、其他。',
        '若确实无法识别，返回 {"ingredients":[]}',
      ].join('\n')
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是小票 OCR 补充助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.45,
        900,
      )
      return this.extractIngredientsFromResponse(content)
    } catch (_) {
      return []
    }
  }

  private async runIngredientLoosePass(dataUrl: string): Promise<RecognizedIngredient[]> {
    try {
      const prompt = [
        '识别这张食材图片中所有你能看到的食材名称。',
        '不要返回 JSON，只返回纯文本，一行一个食材名。',
        '尽量完整，不要只返回 4 条左右；可包含低置信度候选。',
        '只输出食材名称，不要解释。',
      ].join('\n')
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是食材识别补充助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.6,
        2000,
      )
      return this.extractIngredientsFromResponse(content)
    } catch (_) {
      return []
    }
  }

  private async runReceiptLoosePass(dataUrl: string): Promise<RecognizedIngredient[]> {
    try {
      const prompt = [
        '识别这张购物小票里与食材相关的商品名称。',
        '不要返回 JSON，只返回纯文本，一行一个食材名。',
        '尽量完整，不要只返回 4 条左右；忽略金额、门店、时间、合计。',
        '只输出食材名称，不要解释。',
      ].join('\n')
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是小票 OCR 补充助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.6,
        2200,
      )
      return this.extractIngredientsFromResponse(content)
    } catch (_) {
      return []
    }
  }

  private async runIngredientContinuePass(
    dataUrl: string,
    existedNames: string[],
  ): Promise<RecognizedIngredient[]> {
    try {
      const existed = Array.isArray(existedNames) ? existedNames.filter(Boolean) : []
      const prompt = [
        '你正在做食材补全识别。',
        `已识别食材（禁止重复）：${existed.join('、') || '无'}`,
        '请只补充尚未出现的新食材；不要返回已有食材。',
        '只返回 JSON：{"ingredients":[{"name":"食材名","category":"类别","confidence":0.7}]}',
        '如果没有可补充的新食材，返回 {"ingredients":[]}',
      ].join('\n')
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是食材识别补全助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.75,
        1800,
      )
      return this.extractIngredientsFromResponse(content)
    } catch (_) {
      return []
    }
  }

  private async runReceiptContinuePass(
    dataUrl: string,
    existedNames: string[],
  ): Promise<RecognizedIngredient[]> {
    try {
      const existed = Array.isArray(existedNames) ? existedNames.filter(Boolean) : []
      const prompt = [
        '你正在做购物小票食材条目补全。',
        `已识别条目（禁止重复）：${existed.join('、') || '无'}`,
        '请只补充新的食材/食品名称，不要返回已识别条目。',
        '忽略金额、门店、时间、优惠、合计等非食材字段。',
        '只返回 JSON：{"ingredients":[{"name":"食材名","category":"类别","quantity":1,"unit":"个","confidence":0.7}]}',
        '如果没有新条目，返回 {"ingredients":[]}',
      ].join('\n')
      const content = await this.callDashScope(
        this.visionModel,
        [
          { role: 'system', content: '你是小票 OCR 补全助手。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        false,
        0.75,
        2200,
      )
      return this.extractIngredientsFromResponse(content)
    } catch (_) {
      return []
    }
  }

  private mergeRecognizedIngredients(
    base: RecognizedIngredient[],
    extra: RecognizedIngredient[],
  ): RecognizedIngredient[] {
    const merged = [...(Array.isArray(base) ? base : []), ...(Array.isArray(extra) ? extra : [])]
    const seen = new Set<string>()
    const output: RecognizedIngredient[] = []
    for (const item of merged) {
      const key = `${item?.name || ''}`.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      output.push(item)
      if (output.length >= 20) break
    }
    return output
  }

  private pickIngredientArray(parsed: any): any[] {
    if (!parsed) return []
    if (Array.isArray(parsed)) return parsed

    const candidateKeys = [
      'ingredients',
      'items',
      'list',
      'data',
      'result',
      'foods',
      'foodItems',
      'food_items',
      '食材',
      '食材列表',
      '条目',
    ]
    for (const key of candidateKeys) {
      if (Array.isArray(parsed?.[key])) return parsed[key]
    }
    return []
  }

  private parseIngredientsFallback(content: string): any[] {
    if (!content) return []
    const plainText = `${content}`.replace(/```[\s\S]*?```/g, '').trim()
    const codeBlockText = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() || ''
    const text = plainText || codeBlockText
    if (!text) return []

    const rawTokens = text
      .replace(/[，,、；;。]/g, '\n')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const blacklist = new Set([
      'json',
      'ingredients',
      'items',
      'name',
      'category',
      'confidence',
      'quantity',
      'unit',
      '无法识别',
      '未识别',
    ])

    const tokens = rawTokens.filter((t) => {
      const lower = t.toLowerCase()
      if (!t || t.length > 40) return false
      if (/[:{}[\]"]/g.test(t)) return false
      if (/^\d+(\.\d+)?$/.test(t)) return false
      if (blacklist.has(lower)) return false
      return true
    })

    const seen = new Set<string>()
    return tokens
      .filter((name) => {
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })
      .slice(0, 20)
      .map((name) => ({ name, category: '其他' }))
  }

  private normalizeRecognizedIngredient(item: any): RecognizedIngredient {
    const rawName = `${
      item?.name ||
      item?.ingredient ||
      item?.food ||
      item?.title ||
      item?.名称 ||
      item?.食材 ||
      item?.食材名称 ||
      item?.品名 ||
      item?.商品名 ||
      ''
    }`.trim()
    const name = this.canonicalizeIngredientName(this.cleanIngredientName(rawName))
    const rawCategory = `${item?.category || item?.type || item?.分类 || item?.类别 || ''}`.trim()
    const category =
      (this.validCategories.has(rawCategory) ? rawCategory : this.inferCategoryByName(name)) || '其他'
    const quantityRaw = Number(item?.quantity ?? item?.amount ?? item?.数量)
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : undefined
    const confidenceRaw = Number(item?.confidence ?? item?.score ?? item?.置信度)
    const confidence = Number.isFinite(confidenceRaw)
      ? Number(Math.max(0, Math.min(1, confidenceRaw)).toFixed(2))
      : undefined
    const unit = `${item?.unit || item?.uom || item?.单位 || ''}`.trim() || undefined

    return {
      name,
      category,
      quantity,
      unit,
      confidence,
    }
  }

  private cleanIngredientName(raw: string): string {
    if (!raw) return ''
    let text = `${raw}`.trim()
    text = text
      .replace(/[()（）【】\[\]<>]/g, ' ')
      .replace(/^[\d\s._-]*[、.)）]?\s*/g, ' ')
      .replace(/\b(x|X)\d+\b/g, ' ')
      .replace(/\d+(\.\d+)?(元|块|kg|g|ml|l|L|斤|两|个|盒|包|袋|瓶|罐|支|根)?/g, ' ')
      .replace(/(净含量|净重|规格|约|共)\s*/g, ' ')
      .replace(/[￥¥$]/g, ' ')
      .replace(/[：:;；，,。]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    text = text.replace(/^(有机|精品|优选|新鲜|鲜切|冷冻|冷藏|散装|国产|进口)\s*/g, '').trim()

    const noiseFragments = [
      '合计', '小计', '实收', '应收', '找零', '优惠', '折扣', '会员', '积分', '扫码', '支付',
      '微信', '支付宝', '银联', '收银', '门店', '店号', '交易', '订单', '单号', '时间', '日期',
      '电话', '地址', '税', '发票', '谢谢惠顾', '欢迎下次'
    ]
    for (const n of noiseFragments) {
      if (text.includes(n)) return ''
    }
    return text
  }

  private canonicalizeIngredientName(name: string): string {
    const text = `${name || ''}`.trim()
    if (!text) return ''
    if (this.ingredientAliasMap[text]) return this.ingredientAliasMap[text]
    const normalized = this.normalizeIngredientTextForMatch(text)
    for (const key of Object.keys(this.ingredientAliasMap)) {
      const normalizedKey = this.normalizeIngredientTextForMatch(key)
      if (normalizedKey && normalized === normalizedKey) return this.ingredientAliasMap[key]
    }
    for (const key of Object.keys(this.ingredientAliasMap)) {
      const normalizedKey = this.normalizeIngredientTextForMatch(key)
      if (normalizedKey && normalized.includes(normalizedKey)) return this.ingredientAliasMap[key]
    }
    return text
  }

  private normalizeIngredientTextForMatch(text: string): string {
    return `${text || ''}`
      .toLowerCase()
      .replace(/[()（）【】\[\]<>]/g, ' ')
      .replace(/\d+(\.\d+)?\s*(kg|g|ml|l|斤|两|克|千克|公斤|个|包|袋|盒|瓶|罐|支|根|条|片|块|份|颗)/gi, ' ')
      .replace(/(新鲜|鲜切|冷冻|冷藏|散装|精品|特级|有机|即食|去皮|去骨|切片|切丝|切丁|整颗|整只|整条|国产|进口)/g, '')
      .replace(/[\s\-_.，,、:：;；/\\]+/g, '')
      .trim()
  }

  private isNoiseIngredientName(name: string): boolean {
    if (!name) return true
    if (name.length > 24) return true
    if (/^\d+(\.\d+)?$/.test(name)) return true
    if (/^(TOTAL|SUBTOTAL|SUM|AMOUNT)$/i.test(name)) return true
    return false
  }

  private inferCategoryByName(name: string): string {
    const s = `${name || ''}`
    if (!s) return '其他'
    if (/(苹果|香蕉|橙|梨|桃|葡萄|莓|西瓜|哈密瓜|柚|柠檬|樱桃|芒果|菠萝|榴莲)/.test(s)) return '水果'
    if (/(菜|葱|姜|蒜|椒|茄|瓜|萝卜|土豆|西兰花|蘑菇|菌|豆角|白菜|生菜|菠菜|芹菜)/.test(s)) return '蔬菜'
    if (/(牛肉|猪肉|羊肉|鸡肉|鸭肉|排骨|里脊|肉馅|火腿|培根)/.test(s)) return '肉类'
    if (/(蛋|牛奶|酸奶|芝士|黄油|奶酪|奶油)/.test(s)) return '蛋奶'
    if (/(虾|鱼|蟹|贝|蛤|鱿鱼|海参|海带)/.test(s)) return '海鲜'
    if (/(可乐|雪碧|果汁|饮料|矿泉水|纯净水|茶饮|咖啡)/.test(s)) return '饮料'
    if (/(酱|醋|盐|糖|料酒|生抽|老抽|蚝油|胡椒|孜然|番茄酱|沙拉酱)/.test(s)) return '调味品'
    return '其他'
  }

  private mockRecognize(): RecognizedIngredient[] {
    return [
      { name: '番茄', category: '蔬菜', confidence: 0.95 },
      { name: '鸡蛋', category: '蛋奶', confidence: 0.92 },
    ]
  }

  private mockRecipes(ingredients: any[], count: number): GeneratedRecipe[] {
    const top = ingredients.slice(0, 2)
    const topText = top.map((x: any) => x?.name).filter(Boolean).join('、')
    return Array.from({ length: count }).map((_, idx) => ({
      id: `ai_${idx + 1}`,
      name: idx === 0 ? `${topText || '家常'}快手炒` : `家常推荐菜谱 ${idx + 1}`,
      duration: 12 + idx * 3,
      difficulty: idx === 0 ? '简单' : '中等',
      matchScore: 96 - idx * 4,
      coverImage: '',
      ingredients: top,
      steps: ['准备并清洗食材。', '按顺序下锅翻炒。', '调味后出锅装盘。'],
      tips: '根据口味调整盐量。',
    }))
  }
}
