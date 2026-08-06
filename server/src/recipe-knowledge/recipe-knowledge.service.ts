import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import neo4j, { Driver } from 'neo4j-driver'

export type RecipeKnowledgeDocument = {
  id: string
  name: string
  aliases: string[]
  category: string
  cuisine: string
  taste: string[]
  methods: string[]
  difficulty: string
  durationMinutes: number
  servings: number
  ingredients: Array<{
    name: string
    normalizedName: string
    quantity: number | null
    unit: string
    rawAmount?: string
    role: string
    required: boolean
    substitutes: string[]
  }>
  cookware: string[]
  steps: Array<{
    order: number
    title: string
    description: string
    durationMinutes: number
    heat: string | null
    temperatureCelsius: number | null
    ingredientsUsed: string[]
    cookwareUsed: string[]
  }>
  tips: string[]
  nutritionPerServing: null | {
    calories: number
    protein: number
    fat: number
    carbohydrates: number
    fiber: number
    sodium: number
    basis: string
    estimated: true
  }
  dietTags: string[]
  allergens: string[]
  suitableMeals: string[]
  embeddingText: string
  quality: { status: string; score: number; version: number; curationMethod: string }
  source?: { provider: string; sourceRecipeId: string; url: string; license: string }
}

export type RecipeKnowledgeSearchOptions = {
  ingredients: string[]
  limit?: number
  maxDuration?: number
  difficulty?: string
  taste?: string
  avoidances?: string[]
  excludeNames?: string[]
}

export type RecipeKnowledgeHit = {
  recipe: RecipeKnowledgeDocument
  score: number
  matchedIngredients: string[]
  missingIngredients: string[]
  retrievalMode: 'neo4j-vector' | 'neo4j-graph' | 'local-hybrid'
}

export type RecipeNutritionEstimate = {
  calories: number
  protein: number
  fat: number
  carbohydrates: number
  fiber: number
  sodium: number
  analysis: string
}

@Injectable()
export class RecipeKnowledgeService implements OnModuleDestroy {
  private readonly logger = new Logger(RecipeKnowledgeService.name)
  private readonly recipes: RecipeKnowledgeDocument[]
  private readonly recipesByKey = new Map<string, RecipeKnowledgeDocument>()
  private readonly nutritionByRecipeId = new Map<string, RecipeNutritionEstimate>()
  private driver: Driver | null = null
  private neo4jUnavailableLogged = false

  private readonly neo4jUri = `${process.env.NEO4J_URI || ''}`.trim()
  private readonly neo4jUser = `${process.env.NEO4J_USER || 'neo4j'}`.trim()
  private readonly neo4jPassword = `${process.env.NEO4J_PASSWORD || ''}`
  private readonly neo4jDatabase = `${process.env.NEO4J_DATABASE || 'neo4j'}`.trim()
  private readonly embeddingEndpoint = `${process.env.DASHSCOPE_EMBEDDING_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings'}`.trim()
  private readonly embeddingModel = `${process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v4'}`.trim()
  private readonly embeddingDimensions = Math.max(64, Math.min(2048, Number(process.env.DASHSCOPE_EMBEDDING_DIMENSIONS || 1024)))
  private readonly apiKey = `${process.env.DASHSCOPE_API_KEY || ''}`.trim()

  constructor() {
    this.recipes = this.loadRecipes()
    for (const recipe of this.recipes) {
      for (const value of [recipe.id, recipe.name, ...(recipe.aliases || [])]) {
        const key = this.normalizeText(value)
        if (key && !this.recipesByKey.has(key)) this.recipesByKey.set(key, recipe)
      }
    }
    this.logger.log(`菜谱知识库已加载：${this.recipes.length} 道`)
  }

  async onModuleDestroy() {
    await this.driver?.close()
  }

  getStatus() {
    return {
      recipeCount: this.recipes.length,
      neo4jConfigured: Boolean(this.neo4jUri && this.neo4jPassword),
      vectorConfigured: Boolean(this.apiKey),
      embeddingModel: this.embeddingModel,
      embeddingDimensions: this.embeddingDimensions,
      fallbackMode: 'local-hybrid',
    }
  }

  findByIdOrName(value: unknown) {
    return this.recipesByKey.get(this.normalizeText(value)) || null
  }

  async getRecipeNutrition(recipe: RecipeKnowledgeDocument): Promise<RecipeNutritionEstimate | null> {
    if (recipe.nutritionPerServing) {
      return {
        calories: recipe.nutritionPerServing.calories,
        protein: recipe.nutritionPerServing.protein,
        fat: recipe.nutritionPerServing.fat,
        carbohydrates: recipe.nutritionPerServing.carbohydrates,
        fiber: recipe.nutritionPerServing.fiber,
        sodium: recipe.nutritionPerServing.sodium,
        analysis: recipe.nutritionPerServing.estimated ? '每人份估算值，仅用于日常饮食参考。' : '每人份营养数据。',
      }
    }
    const cached = this.nutritionByRecipeId.get(recipe.id)
    if (cached) return cached
    if (!this.neo4jUri || !this.neo4jPassword) return null
    try {
      const result = await this.getDriver().executeQuery(
        'MATCH (recipe:Recipe {id: $id}) RETURN recipe.nutritionJson AS nutritionJson',
        { id: recipe.id },
        { database: this.neo4jDatabase },
      )
      const raw = `${result.records[0]?.get('nutritionJson') || ''}`
      if (!raw) return null
      const nutrition = JSON.parse(raw) as RecipeNutritionEstimate
      this.nutritionByRecipeId.set(recipe.id, nutrition)
      return nutrition
    } catch (error: any) {
      this.logger.warn(`读取菜谱营养缓存失败：${recipe.id}，${error?.message || error}`)
      return null
    }
  }

  async saveRecipeNutrition(recipeId: string, nutrition: RecipeNutritionEstimate) {
    this.nutritionByRecipeId.set(recipeId, nutrition)
    if (!this.neo4jUri || !this.neo4jPassword) return
    try {
      await this.getDriver().executeQuery(
        'MATCH (recipe:Recipe {id: $id}) SET recipe.nutritionJson = $nutritionJson',
        { id: recipeId, nutritionJson: JSON.stringify(nutrition) },
        { database: this.neo4jDatabase },
      )
    } catch (error: any) {
      this.logger.warn(`保存菜谱营养缓存失败：${recipeId}，${error?.message || error}`)
    }
  }

  async search(options: RecipeKnowledgeSearchOptions): Promise<RecipeKnowledgeHit[]> {
    const normalized = {
      ...options,
      limit: Math.min(Math.max(Number(options.limit || 12), 1), 50),
      ingredients: this.uniqueStrings(options.ingredients),
      avoidances: this.uniqueStrings(options.avoidances || []),
      excludeNames: this.uniqueStrings(options.excludeNames || []),
    }
    if (!normalized.ingredients.length) return []

    if (this.neo4jUri && this.neo4jPassword) {
      try {
        const graphHits = await this.searchNeo4j(normalized)
        if (graphHits.length) return graphHits.slice(0, normalized.limit)
      } catch (error: any) {
        if (!this.neo4jUnavailableLogged) {
          this.logger.warn(`Neo4j 检索不可用，已降级到本地知识库：${error?.message || error}`)
          this.neo4jUnavailableLogged = true
        }
      }
    }
    return this.rankRecipes(this.recipes, normalized, new Map(), 'local-hybrid').slice(0, normalized.limit)
  }

  private loadRecipes() {
    const directory = resolve(process.env.RECIPE_KNOWLEDGE_DIR || resolve(process.cwd(), 'data/recipe-knowledge'))
    const files = readdirSync(directory).filter((name) => /^recipes\..+\.json$/u.test(name)).sort()
    return files.flatMap((name) => {
      const value = JSON.parse(readFileSync(resolve(directory, name), 'utf8'))
      return Array.isArray(value) ? value : []
    }) as RecipeKnowledgeDocument[]
  }

  private getDriver() {
    if (!this.driver) {
      this.driver = neo4j.driver(this.neo4jUri, neo4j.auth.basic(this.neo4jUser, this.neo4jPassword))
    }
    return this.driver
  }

  private async searchNeo4j(options: RecipeKnowledgeSearchOptions & { limit: number }) {
    const driver = this.getDriver()
    const terms = options.ingredients.map((value) => this.normalizeIngredient(value)).filter(Boolean)
    const candidateLimit = Math.min(Math.max(options.limit * 6, 30), 100)
    const semanticScores = new Map<string, number>()
    let recipeJsonValues: string[] = []

    if (this.apiKey) {
      const queryText = `可用食材：${options.ingredients.join('、')}；口味：${options.taste || '家常'}；时长：${options.maxDuration || '不限'}分钟；难度：${options.difficulty || '不限'}`
      const [embedding] = await this.createEmbeddings([queryText])
      const result = await driver.executeQuery(
        `CALL db.index.vector.queryNodes('recipe_embedding_index', $limit, $embedding)
         YIELD node, score
         RETURN node.id AS id, node.fullRecipeJson AS recipeJson, score
         ORDER BY score DESC`,
        { limit: neo4j.int(candidateLimit), embedding },
        { database: this.neo4jDatabase },
      )
      for (const record of result.records) {
        const id = `${record.get('id') || ''}`
        const value = `${record.get('recipeJson') || ''}`
        if (value) recipeJsonValues.push(value)
        semanticScores.set(id, Number(record.get('score') || 0))
      }
    }

    if (!recipeJsonValues.length) {
      const result = await driver.executeQuery(
        `MATCH (recipe:Recipe)
         WHERE any(term IN $terms WHERE any(name IN recipe.ingredientNames
           WHERE toLower(name) CONTAINS term OR term CONTAINS toLower(name)))
         RETURN recipe.fullRecipeJson AS recipeJson
         LIMIT $limit`,
        { terms, limit: neo4j.int(candidateLimit) },
        { database: this.neo4jDatabase },
      )
      recipeJsonValues = result.records.map((record) => `${record.get('recipeJson') || ''}`).filter(Boolean)
    }

    const candidates = recipeJsonValues.map((value) => JSON.parse(value) as RecipeKnowledgeDocument)
    const mode = semanticScores.size ? 'neo4j-vector' : 'neo4j-graph'
    return this.rankRecipes(candidates, options, semanticScores, mode)
  }

  private async createEmbeddings(texts: string[]) {
    const response = await fetch(this.embeddingEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.embeddingModel, input: texts, dimensions: this.embeddingDimensions }),
    })
    const payload: any = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error?.message || `向量接口失败：HTTP ${response.status}`)
    const data = Array.isArray(payload?.data) ? payload.data.slice().sort((a: any, b: any) => Number(a.index) - Number(b.index)) : []
    const embeddings = data.map((item: any) => item.embedding).filter((item: any) => Array.isArray(item))
    if (embeddings.length !== texts.length) throw new Error('向量接口返回数量不完整')
    return embeddings as number[][]
  }

  private rankRecipes(
    recipes: RecipeKnowledgeDocument[],
    options: RecipeKnowledgeSearchOptions & { limit: number },
    semanticScores: Map<string, number>,
    retrievalMode: RecipeKnowledgeHit['retrievalMode'],
  ) {
    const pantry = options.ingredients.map((value) => this.normalizeIngredient(value)).filter(Boolean)
    const avoidances = (options.avoidances || []).map((value) => this.normalizeIngredient(value)).filter(Boolean)
    const excluded = new Set((options.excludeNames || []).map((value) => this.normalizeText(value)))
    const taste = this.normalizeText(options.taste)
    const difficulty = `${options.difficulty || ''}`.trim()
    const maxDuration = Math.max(0, Number(options.maxDuration || 0))
    const hits: RecipeKnowledgeHit[] = []

    for (const recipe of recipes) {
      if (excluded.has(this.normalizeText(recipe.name))) continue
      const searchable = this.normalizeIngredient([
        recipe.name,
        ...(recipe.aliases || []),
        ...(recipe.ingredients || []).flatMap((item) => [item.name, item.normalizedName]),
      ].join(' '))
      if (avoidances.some((value) => value && searchable.includes(value))) continue

      const matchedPantry = pantry.filter((value) => (recipe.ingredients || []).some((item) => this.ingredientMatches(value, item.normalizedName || item.name)))
      if (!matchedPantry.length) continue
      const matchedIngredients = (recipe.ingredients || [])
        .filter((item) => pantry.some((value) => this.ingredientMatches(value, item.normalizedName || item.name)))
        .map((item) => item.name)
      const missingIngredients = (recipe.ingredients || [])
        .filter((item) => item.required && item.role !== '调味料' && !pantry.some((value) => this.ingredientMatches(value, item.normalizedName || item.name)))
        .map((item) => item.name)
      const coverage = matchedPantry.length / pantry.length
      const timeScore = maxDuration ? Math.max(0, 1 - Math.max(0, recipe.durationMinutes - maxDuration) / Math.max(maxDuration, 1)) : 1
      const difficultyScore = difficulty ? (recipe.difficulty === difficulty ? 1 : 0.4) : 1
      const tasteScore = taste && (recipe.taste || []).some((value) => this.normalizeText(value).includes(taste)) ? 1 : taste ? 0.3 : 1
      const semanticScore = semanticScores.get(recipe.id) ?? 0.55
      const missingPenalty = Math.min(missingIngredients.length * 0.025, 0.15)
      const total = coverage * 0.48 + semanticScore * 0.22 + timeScore * 0.1 + difficultyScore * 0.06 + tasteScore * 0.04 + Number(recipe.quality?.score || 0.8) * 0.1 - missingPenalty
      hits.push({
        recipe,
        score: Math.max(0, Math.min(100, Math.round(total * 100))),
        matchedIngredients: this.uniqueStrings(matchedIngredients),
        missingIngredients: this.uniqueStrings(missingIngredients),
        retrievalMode,
      })
    }
    return hits.sort((a, b) => b.score - a.score || a.missingIngredients.length - b.missingIngredients.length || a.recipe.durationMinutes - b.recipe.durationMinutes)
  }

  private ingredientMatches(left: unknown, right: unknown) {
    const a = this.normalizeIngredient(left)
    const b = this.normalizeIngredient(right)
    if (!a || !b) return false
    if (a === b) return true
    const processedFoodSuffix = /酱|汁|粉|油|酒|醋|膏|罐头$/u
    if ((processedFoodSuffix.test(a) || processedFoodSuffix.test(b)) && a !== b) return false
    return a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))
  }

  private normalizeIngredient(value: unknown) {
    const aliases: Record<string, string> = {
      西红柿: '番茄', 马铃薯: '土豆', 洋芋: '土豆', 猪里脊: '猪肉', 里脊肉: '猪肉', 五花肉: '猪肉',
      牛里脊: '牛肉', 牛腩: '牛肉', 肥牛: '牛肉', 鸡胸: '鸡胸肉', 基围虾: '虾', 明虾: '虾', 白虾: '虾',
      油麦菜: '生菜', 西芹: '芹菜', 意大利面: '面条', 意面: '面条', 挂面: '面条', 乌冬面: '面条',
    }
    let text = this.normalizeText(value)
    for (const [from, to] of Object.entries(aliases)) text = text.replaceAll(this.normalizeText(from), this.normalizeText(to))
    return text
  }

  private normalizeText(value: unknown) {
    return `${value || ''}`.trim().toLowerCase().replace(/[\s，。、“”‘’'"（）()【】\[\]_-]+/gu, '')
  }

  private uniqueStrings(values: unknown[]) {
    return [...new Set(values.map((value) => `${value || ''}`.trim()).filter(Boolean))]
  }
}
