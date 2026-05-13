import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

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
  matchScore: number
  coverImage: string
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>
  steps: string[]
  tips?: string
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

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger(AiService.name)

  private readonly apiKey = process.env.DASHSCOPE_API_KEY || ''
  private readonly endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  private readonly asrEndpoint =
    process.env.DASHSCOPE_ASR_ENDPOINT ||
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  private readonly visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen2.5-vl-7b-instruct'
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
      'JSON 结构：{"ingredients":[{"name":"食材名","category":"类别","confidence":0.95}]}',
      'category 仅可取：水果、蔬菜、肉类、蛋奶、海鲜、饮料、调味品、其他。',
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
        1600,
      )

      const primary = this.extractIngredientsFromResponse(content)
      if (primary.length >= 10) return primary

      const enhanced = await this.runIngredientEnhancePass(dataUrl)
      const merged = this.mergeRecognizedIngredients(primary, enhanced)
      if (merged.length >= 10) return merged

      const loose = await this.runIngredientLoosePass(dataUrl)
      let result = this.mergeRecognizedIngredients(merged, loose)
      if (result.length >= 10) return result

      for (let round = 0; round < 5 && result.length < 16; round += 1) {
        const extra = await this.runIngredientContinuePass(
          dataUrl,
          result.map((x) => x.name).filter(Boolean),
        )
        const next = this.mergeRecognizedIngredients(result, extra)
        if (next.length <= result.length) break
        result = next
      }
      return result
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
        1800,
      )

      const primary = this.extractIngredientsFromResponse(content)
      if (primary.length >= 12) return primary

      const enhanced = await this.runReceiptEnhancePass(dataUrl)
      const merged = this.mergeRecognizedIngredients(primary, enhanced)
      if (merged.length >= 12) return merged

      const loose = await this.runReceiptLoosePass(dataUrl)
      let result = this.mergeRecognizedIngredients(merged, loose)
      if (result.length >= 12) return result

      for (let round = 0; round < 5 && result.length < 26; round += 1) {
        const extra = await this.runReceiptContinuePass(
          dataUrl,
          result.map((x) => x.name).filter(Boolean),
        )
        const next = this.mergeRecognizedIngredients(result, extra)
        if (next.length <= result.length) break
        result = next
      }
      return result
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
      const name = `${parsed?.name || ''}`.trim() || fallback.name
      const quantity = this.normalizeVoiceQuantity(parsed?.quantity ?? fallback.quantity)
      const unit = `${parsed?.unit || ''}`.trim() || fallback.unit
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

  async generateRecipeList(payload: any): Promise<RecipeGenerateResult> {
    const ingredients = Array.isArray(payload?.ingredients) ? payload.ingredients : []
    const count = Math.min(Math.max(Number(payload?.count || 6), 1), 10)
    const cookingTime = Number(payload?.cookingTime || 30)
    const tastePreference = `${payload?.tastePreference || '家常'}`
    const excludeNames = this.normalizeStringArray(payload?.excludeNames)
    const requestNonce = `${payload?.requestNonce || ''}`.trim()
    const userId = Math.max(Number(payload?.userId || 1), 1)
    const profile = await this.loadUserProfileForRecipe(userId)
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
    if (!this.apiKey) {
      const mocked = this.filterRecipesByAvoidances(this.mockRecipes(ingredients, count), avoidances)
      profileApplied.generatedCount = mocked.length
      profileApplied.removedByAvoidanceCount = Math.max(count - mocked.length, 0)
      profileApplied.reducedByAvoidance = profileApplied.removedByAvoidanceCount > 0
      return { recipes: mocked.slice(0, count), profileApplied }
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
    const pantryNames = ingredients
      .map((x: any) => `${x?.name || ''}`.trim())
      .filter(Boolean)

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
      `本次生成随机标识：${requestNonce || 'none'}`,
      `食材：${ingredientText}`,
      '菜谱合理性要求（必须遵守）：',
      '1) 菜名必须是常见家常菜，不要生造菜名，不要出现明显违和组合（如“苹果炒土豆”）。',
      '2) 每道菜至少命中 1 种库存食材（库存优先）。',
      '3) 允许补充 1-3 种常见缺失食材来让菜谱成立（如“土豆炖牛肉”可补充牛肉）。',
      '4) 不要为了凑数量输出不符合常理的菜。',
      'JSON 结构：',
      '{"recipes":[{"id":"ai_001","name":"菜名","duration":15,"difficulty":"简单","matchScore":95,"coverImage":"","ingredients":[{"name":"番茄","quantity":2,"unit":"个"}],"steps":["步骤1","步骤2"],"tips":"可选"}]}',
      'difficulty 仅可取：简单、中等、困难。',
      'matchScore 范围 0-100。',
      'steps 按实际烹饪需要返回，不限制步数；每一步都要具体可执行（包含关键动作或火候信息）。',
      '如果无法生成，返回 {"recipes":[]}',
    ].join('\n')

    let content = ''
    try {
      content = await this.callDashScope(
        this.textModel,
        [
          { role: 'system', content: '你是结构化 JSON 菜谱生成助手。' },
          { role: 'user', content: prompt },
        ],
        true,
        0.2,
        2200,
      )
    } catch (err) {
      this.logger.warn(
        `DashScope generate-recipe failed, fallback to mock: ${err?.message || err || 'unknown error'}`,
      )
      const mocked = this.filterRecipesByAvoidances(this.mockRecipes(ingredients, count), avoidances)
      profileApplied.generatedCount = mocked.length
      profileApplied.removedByAvoidanceCount = Math.max(count - mocked.length, 0)
      profileApplied.reducedByAvoidance = profileApplied.removedByAvoidanceCount > 0
      return { recipes: mocked.slice(0, count), profileApplied }
    }

    const parsed = this.parseJson(content)
    const list = this.pickRecipeArray(parsed)
    const fallbackRecipes = !list.length ? this.parseRecipeArrayFallback(content) : []
    const recipeSource = list.length ? list : fallbackRecipes
    let recipes = recipeSource
      .map((item: any, idx: number) => this.normalizeRecipe(item, idx))
      .filter((x: GeneratedRecipe) => !!x.name && Array.isArray(x.steps) && x.steps.length > 0)
    recipes = this.dedupeRecipesByName(recipes)
    const recipesBeforeExclude = recipes.slice()
    if (excludeNames.length) {
      const blocked = new Set(excludeNames.map((x) => this.normalizeTextForCompare(x)))
      recipes = recipes.filter((x) => !blocked.has(this.normalizeTextForCompare(x.name)))
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
    this.logger.log(
      `recipe-filter-stats parsed=${list.length}, fallbackParsed=${fallbackRecipes.length}, normalized=${recipesBeforeExclude.length}, afterExclude=${recipesBeforeAnyStrictFilter.length}, afterPantry=${beforeFilterCount}, afterAvoidance=${recipes.length}`,
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
        '如果菜名与已有菜谱重复，则该条视为无效，不要返回。',
        `口味偏好：${tastePreference}`,
        `饮食偏好（软约束）：${dietPreferences.length ? dietPreferences.join('、') : '无特别偏好'}`,
        `可用厨具（软约束）：${cookwareNote || '按常见家用厨具处理'}`,
        `忌口食材（硬约束，必须严格避开）：${avoidances.length ? avoidances.join('、') : '无'}`,
        '规则：任何菜谱名称、食材列表、步骤、tips 中都不允许出现忌口食材或其同义表述。',
        `期望总烹饪时长（分钟）：${cookingTime}`,
        `食材：${ingredientText}`,
        `本次生成随机标识：${requestNonce || Date.now()}`,
        '菜谱合理性要求（必须遵守）：',
        '1) 菜名必须是常见家常菜，不要生造菜名，不要出现明显违和组合（如“苹果炒土豆”）。',
        '2) 每道菜至少命中 1 种库存食材（库存优先）。',
        '3) 允许补充 1-3 种常见缺失食材来让菜谱成立（如“土豆炖牛肉”可补充牛肉）。',
        '4) 不要为了凑数量输出不符合常理的菜。',
        'JSON 结构：',
        '{"recipes":[{"id":"ai_001","name":"菜名","duration":15,"difficulty":"简单","matchScore":95,"coverImage":"","ingredients":[{"name":"番茄","quantity":2,"unit":"个"}],"steps":["步骤1","步骤2"],"tips":"可选"}]}',
        'difficulty 仅可取：简单、中等、困难。',
        'matchScore 范围 0-100。',
        '如果无法生成，返回 {"recipes":[]}',
      ].join('\n')
      let retryContent = ''
      try {
        retryContent = await this.callDashScope(
          this.textModel,
          [
            { role: 'system', content: '你是结构化 JSON 菜谱生成助手。' },
            { role: 'user', content: retryPrompt },
          ],
          true,
          excludeNames.length ? 0.55 : 0.2,
          2200,
        )
      } catch (_) {
        this.logger.warn('DashScope retry generate-recipe failed, keep current generated recipes')
        retryContent = ''
      }
      const retryParsed = this.parseJson(retryContent)
      const retryList = this.pickRecipeArray(retryParsed)
      const retryNormalized = retryList
        .map((item: any, idx: number) => this.normalizeRecipe(item, recipes.length + idx))
        .filter((x: GeneratedRecipe) => !!x.name && Array.isArray(x.steps) && x.steps.length > 0)
      const retryDeduped = this.dedupeRecipesByName(retryNormalized)
      const retryRecipes = this.filterRecipesByAvoidances(retryDeduped, avoidances)
      removedByAvoidanceCount += Math.max(retryDeduped.length - retryRecipes.length, 0)
      const seen = new Set([
        ...excludeNames.map((x) => this.normalizeTextForCompare(x)),
        ...recipes.map((x) => this.normalizeTextForCompare(x.name)),
      ])
      for (const item of retryRecipes) {
        const key = this.normalizeTextForCompare(item.name)
        if (!key || seen.has(key)) continue
        recipes.push(item)
        seen.add(key)
        if (recipes.length >= count) break
      }
    }
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
      const mocked = this.filterRecipesByAvoidances(this.mockRecipes(ingredients, count), avoidances)
      finalRecipes = mocked.slice(0, count)
    }
    profileApplied.generatedCount = finalRecipes.length
    profileApplied.removedByAvoidanceCount = removedByAvoidanceCount
    profileApplied.reducedByAvoidance = finalRecipes.length < count && removedByAvoidanceCount > 0
    return { recipes: finalRecipes, profileApplied }
  }

  private normalizeRecipe(item: any, idx: number): GeneratedRecipe {
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
      matchScore: Math.max(0, Math.min(100, Number(item?.matchScore || 85))),
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
      steps: steps.length ? steps : ['准备并清洗食材。', '按顺序烹饪并调味后出锅。'],
      tips: `${item?.tips || ''}`.trim(),
    }
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
      const key = this.normalizeTextForCompare(item?.name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      output.push(item)
    }
    return output
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
    const m = cleaned.match(
      /^([\u4e00-\u9fa5A-Za-z]+?)\s*([零一二两三四五六七八九十百千万\d]+(?:\.\d+)?)?\s*(个|颗|斤|公斤|千克|克|袋|包|瓶|盒|罐|把|根|条|片|块|份|毫升|升)?$/,
    )
    if (!m) {
      return {
        name: cleaned,
        quantity: undefined as number | undefined,
        unit: '',
        items: multiItems,
      }
    }
    const [, rawName = '', rawQty = '', rawUnit = ''] = m
    return {
      name: rawName.trim(),
      quantity: this.normalizeVoiceQuantity(rawQty),
      unit: rawUnit.trim(),
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
        const m = part.match(
          /^([\u4e00-\u9fa5A-Za-z]+?)\s*([零一二两三四五六七八九十百千万\d]+(?:\.\d+)?)?\s*(个|颗|斤|公斤|千克|克|袋|包|瓶|盒|罐|把|根|条|片|块|份|毫升|升)?$/,
        )
        if (!m) return { name: part }
        const [, rawName = '', rawQty = '', rawUnit = ''] = m
        return {
          name: rawName.trim(),
          quantity: this.normalizeVoiceQuantity(rawQty),
          unit: rawUnit.trim() || undefined,
        }
      })
      .filter((x) => !!`${x?.name || ''}`.trim())
    return list
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
      .map((x) => ({
        name: `${x?.name || ''}`.trim(),
        quantity: this.normalizeVoiceQuantity(x?.quantity),
        unit: `${x?.unit || ''}`.trim() || undefined,
        category: this.validCategories.has(`${x?.category || ''}`.trim()) ? `${x?.category}`.trim() : undefined,
      }))
      .filter((x) => !!x.name)
    if (normalized.length) return normalized
    if (!single.name) return []
    return [
      {
        name: single.name,
        quantity: this.normalizeVoiceQuantity(single.quantity),
        unit: `${single.unit || ''}`.trim() || undefined,
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
        'JSON 结构：{"ingredients":[{"name":"食材名","category":"类别","confidence":0.75}]}',
        'category 仅可取：水果、蔬菜、肉类、蛋奶、海鲜、饮料、调味品、其他。',
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
        1600,
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
        1800,
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
