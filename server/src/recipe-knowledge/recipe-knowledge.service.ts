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
  query?: string
  allowEmpty?: boolean
  requireAllIngredients?: boolean
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
  retrievalMode: 'neo4j-hybrid' | 'neo4j-vector' | 'neo4j-graph' | 'neo4j-fulltext' | 'local-hybrid'
}

type NormalizedSearchOptions = RecipeKnowledgeSearchOptions & {
  limit: number
  ingredients: string[]
  avoidances: string[]
  excludeNames: string[]
}

type Neo4jCandidate = { id: string; recipeJson: string; score: number }
type CacheEntry<T> = { value: T; expiresAt: number }

@Injectable()
export class RecipeKnowledgeService implements OnModuleDestroy {
  private readonly logger = new Logger(RecipeKnowledgeService.name)
  private readonly recipes: RecipeKnowledgeDocument[]
  private readonly recipesByKey = new Map<string, RecipeKnowledgeDocument>()
  private driver: Driver | null = null
  private neo4jUnavailableLogged = false
  private readonly searchCache = new Map<string, CacheEntry<RecipeKnowledgeHit[]>>()
  private readonly searchInFlight = new Map<string, Promise<RecipeKnowledgeHit[]>>()
  private readonly embeddingCache = new Map<string, CacheEntry<number[]>>()

  private readonly neo4jUri = `${process.env.NEO4J_URI || ''}`.trim()
  private readonly neo4jUser = `${process.env.NEO4J_USER || 'neo4j'}`.trim()
  private readonly neo4jPassword = `${process.env.NEO4J_PASSWORD || ''}`
  private readonly neo4jDatabase = `${process.env.NEO4J_DATABASE || 'neo4j'}`.trim()
  private readonly embeddingEndpoint = `${process.env.DASHSCOPE_EMBEDDING_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings'}`.trim()
  private readonly embeddingModel = `${process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v4'}`.trim()
  private readonly embeddingDimensions = Math.max(64, Math.min(2048, Number(process.env.DASHSCOPE_EMBEDDING_DIMENSIONS || 1024)))
  private readonly apiKey = `${process.env.DASHSCOPE_API_KEY || ''}`.trim()
  private readonly searchCacheTtlMs = Math.max(10_000, Number(process.env.RECIPE_SEARCH_CACHE_TTL_MS || 300_000))
  private readonly embeddingCacheTtlMs = Math.max(60_000, Number(process.env.RECIPE_EMBEDDING_CACHE_TTL_MS || 3_600_000))
  private readonly cacheMaxEntries = Math.max(50, Math.min(5_000, Number(process.env.RECIPE_SEARCH_CACHE_MAX_ENTRIES || 500)))
  private readonly routeTimeoutMs = Math.max(2_000, Number(process.env.RECIPE_RETRIEVAL_ROUTE_TIMEOUT_MS || 8_000))

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
    this.searchCache.clear()
    this.searchInFlight.clear()
    this.embeddingCache.clear()
    await this.driver?.close()
  }

  getStatus() {
    return {
      recipeCount: this.recipes.length,
      neo4jConfigured: Boolean(this.neo4jUri && this.neo4jPassword),
      vectorConfigured: Boolean(this.apiKey),
      embeddingModel: this.embeddingModel,
      embeddingDimensions: this.embeddingDimensions,
      searchCacheEntries: this.searchCache.size,
      embeddingCacheEntries: this.embeddingCache.size,
      fallbackMode: 'local-hybrid',
    }
  }

  findByIdOrName(value: unknown) {
    return this.recipesByKey.get(this.normalizeText(value)) || null
  }

  async search(options: RecipeKnowledgeSearchOptions): Promise<RecipeKnowledgeHit[]> {
    const normalized = {
      ...options,
      limit: Math.min(Math.max(Number(options.limit || 12), 1), 50),
      ingredients: this.uniqueStrings(options.ingredients),
      avoidances: this.uniqueStrings(options.avoidances || []),
      excludeNames: this.uniqueStrings(options.excludeNames || []),
    }
    if (!normalized.ingredients.length && !`${normalized.query || ''}`.trim() && !normalized.allowEmpty) return []

    const cacheKey = this.buildSearchCacheKey(normalized)
    const cached = this.getCached(this.searchCache, cacheKey)
    if (cached) {
      this.logger.log(`recipe-retrieval-cache hit=1, results=${cached.length}`)
      return this.cloneHits(cached)
    }
    const current = this.searchInFlight.get(cacheKey)
    if (current) return this.cloneHits(await current)

    const task = this.searchUncached(normalized)
      .then((hits) => {
        const degraded = hits[0]?.retrievalMode === 'local-hybrid' && Boolean(this.neo4jUri && this.neo4jPassword)
        this.setCached(this.searchCache, cacheKey, hits, degraded ? Math.min(this.searchCacheTtlMs, 30_000) : this.searchCacheTtlMs)
        return hits
      })
      .finally(() => this.searchInFlight.delete(cacheKey))
    this.searchInFlight.set(cacheKey, task)
    return this.cloneHits(await task)
  }

  private async searchUncached(options: NormalizedSearchOptions) {
    const startedAt = Date.now()
    if (options.ingredients.length && !options.query && this.neo4jUri && this.neo4jPassword) {
      try {
        const hits = await this.searchNeo4j(options)
        if (hits.length) {
          this.neo4jUnavailableLogged = false
          this.logger.log(`recipe-retrieval mode=${hits[0].retrievalMode}, results=${hits.length}, cache=miss, totalMs=${Date.now() - startedAt}`)
          return hits.slice(0, options.limit)
        }
      } catch (error: any) {
        if (!this.neo4jUnavailableLogged) {
          this.logger.warn(`Neo4j 检索不可用，已降级到本地知识库：${error?.message || error}`)
          this.neo4jUnavailableLogged = true
        }
      }
    }
    const hits = this.rankRecipes(this.recipes, options, new Map(), 'local-hybrid').slice(0, options.limit)
    this.logger.log(`recipe-retrieval mode=local-hybrid, results=${hits.length}, cache=miss, totalMs=${Date.now() - startedAt}`)
    return hits
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

  private async searchNeo4j(options: NormalizedSearchOptions) {
    const driver = this.getDriver()
    const terms = options.ingredients.map((value) => this.normalizeIngredient(value)).filter(Boolean)
    const candidateLimit = Math.min(Math.max(options.limit * 6, 30), 100)
    const queryText = `可用食材：${options.ingredients.join('、')}；口味：${options.taste || '家常'}；时长：${options.maxDuration || '不限'}分钟；难度：${options.difficulty || '不限'}`
    const routes = await Promise.allSettled([
      this.apiKey ? this.withTimeout(this.searchNeo4jVector(driver, queryText, candidateLimit), 'vector') : Promise.resolve([]),
      this.withTimeout(this.searchNeo4jGraph(driver, terms, options, candidateLimit), 'graph'),
      this.withTimeout(this.searchNeo4jFulltext(driver, [...options.ingredients, options.taste || ''].filter(Boolean), candidateLimit), 'fulltext'),
    ])
    const names = ['vector', 'graph', 'fulltext'] as const
    const values = routes.map((route, index) => {
      if (route.status === 'fulfilled') return route.value
      this.logger.warn(`Neo4j ${names[index]} 召回失败：${route.reason?.message || route.reason}`)
      return []
    })
    const nonEmptyRouteCount = values.filter((items) => items.length > 0).length
    this.logger.log(`recipe-retrieval-routes vector=${values[0].length}, graph=${values[1].length}, fulltext=${values[2].length}`)
    if (!nonEmptyRouteCount) return []

    const routeWeights = [0.5, 0.3, 0.2]
    const maxRrf = values.reduce((sum, items, index) => sum + (items.length ? routeWeights[index] / 61 : 0), 0)
    const fused = new Map<string, { recipeJson: string; rrf: number }>()
    values.forEach((items, routeIndex) => {
      items.forEach((item, rank) => {
        if (!item.id || !item.recipeJson) return
        const current = fused.get(item.id) || { recipeJson: item.recipeJson, rrf: 0 }
        current.recipeJson ||= item.recipeJson
        current.rrf += routeWeights[routeIndex] / (60 + rank + 1)
        fused.set(item.id, current)
      })
    })
    const fusionScores = new Map<string, number>()
    const candidates: RecipeKnowledgeDocument[] = []
    for (const [id, item] of fused) {
      try {
        const recipe = JSON.parse(item.recipeJson) as RecipeKnowledgeDocument
        candidates.push(recipe)
        fusionScores.set(id, maxRrf > 0 ? Math.min(1, item.rrf / maxRrf) : 0)
      } catch {
        this.logger.warn(`Neo4j 候选数据无法解析：${id}`)
      }
    }
    const mode: RecipeKnowledgeHit['retrievalMode'] = nonEmptyRouteCount > 1
      ? 'neo4j-hybrid'
      : values[0].length ? 'neo4j-vector' : values[1].length ? 'neo4j-graph' : 'neo4j-fulltext'
    return this.rankRecipes(candidates, options, fusionScores, mode)
  }

  private async searchNeo4jVector(driver: Driver, queryText: string, limit: number): Promise<Neo4jCandidate[]> {
    const embedding = await this.createQueryEmbedding(queryText)
    const result = await driver.executeQuery(
      `CALL db.index.vector.queryNodes('recipe_embedding_index', $limit, $embedding)
       YIELD node, score
       RETURN node.id AS id, node.fullRecipeJson AS recipeJson, score
       ORDER BY score DESC`,
      { limit: neo4j.int(limit), embedding },
      { database: this.neo4jDatabase },
    )
    return this.recordsToCandidates(result.records)
  }

  private async searchNeo4jGraph(driver: Driver, terms: string[], options: NormalizedSearchOptions, limit: number): Promise<Neo4jCandidate[]> {
    const result = await driver.executeQuery(
      `MATCH (recipe:Recipe)-[:USES]->(ingredient:Ingredient)
       WITH recipe, collect(DISTINCT toLower(ingredient.normalizedName)) AS ingredientNames
       WITH recipe, size([term IN $terms WHERE any(name IN ingredientNames
         WHERE name CONTAINS term OR term CONTAINS name)]) AS matchedCount, ingredientNames
       WHERE matchedCount > 0
         AND ($maxDuration <= 0 OR recipe.durationMinutes <= $maxDuration)
         AND none(blocked IN $avoidances WHERE any(name IN ingredientNames
           WHERE name CONTAINS blocked OR blocked CONTAINS name))
         AND none(excluded IN $excludeNames WHERE toLower(recipe.name) = excluded)
       RETURN recipe.id AS id, recipe.fullRecipeJson AS recipeJson, toFloat(matchedCount) AS score
       ORDER BY matchedCount DESC, recipe.qualityScore DESC, recipe.durationMinutes ASC
       LIMIT $limit`,
      {
        terms,
        maxDuration: Number(options.maxDuration || 0),
        avoidances: options.avoidances.map((value) => this.normalizeIngredient(value)),
        excludeNames: options.excludeNames.map((value) => this.normalizeText(value)),
        limit: neo4j.int(limit),
      },
      { database: this.neo4jDatabase },
    )
    return this.recordsToCandidates(result.records)
  }

  private async searchNeo4jFulltext(driver: Driver, values: string[], limit: number): Promise<Neo4jCandidate[]> {
    const query = this.uniqueStrings(values)
      .map((value) => this.normalizeText(value).replace(/[+\-&|!(){}\[\]^"~*?:\\/]/gu, ''))
      .filter(Boolean)
      .map((value) => `"${value}"`)
      .join(' OR ')
    if (!query) return []
    const result = await driver.executeQuery(
      `CALL db.index.fulltext.queryNodes('recipe_fulltext_index', $query, {limit: $limit})
       YIELD node, score
       RETURN node.id AS id, node.fullRecipeJson AS recipeJson, score
       ORDER BY score DESC`,
      { query, limit: neo4j.int(limit) },
      { database: this.neo4jDatabase },
    )
    return this.recordsToCandidates(result.records)
  }

  private recordsToCandidates(records: any[]): Neo4jCandidate[] {
    return records.map((record) => ({
      id: `${record.get('id') || ''}`,
      recipeJson: `${record.get('recipeJson') || ''}`,
      score: Number(record.get('score') || 0),
    })).filter((item) => item.id && item.recipeJson)
  }

  private async createQueryEmbedding(queryText: string) {
    const cacheKey = `${this.embeddingModel}:${this.embeddingDimensions}:${queryText}`
    const cached = this.getCached(this.embeddingCache, cacheKey)
    if (cached) return [...cached]
    const [embedding] = await this.createEmbeddings([queryText])
    this.setCached(this.embeddingCache, cacheKey, embedding, this.embeddingCacheTtlMs)
    return embedding
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
    const query = this.normalizeIngredient(options.query)
    const hits: RecipeKnowledgeHit[] = []

    for (const recipe of recipes) {
      if (excluded.has(this.normalizeText(recipe.name))) continue
      const searchable = this.normalizeIngredient([
        recipe.name,
        ...(recipe.aliases || []),
        ...(recipe.ingredients || []).flatMap((item) => [item.name, item.normalizedName]),
        ...(recipe.taste || []),
        ...(recipe.methods || []),
        ...(recipe.dietTags || []),
        ...(recipe.allergens || []),
      ].join(' '))
      if (avoidances.some((value) => value && searchable.includes(value))) continue
      if (maxDuration && recipe.durationMinutes > maxDuration) continue
      if (query && !searchable.includes(query) && !query.includes(this.normalizeIngredient(recipe.name))) continue

      const matchedPantry = pantry.filter((value) => (recipe.ingredients || []).some((item) => this.ingredientMatches(value, item.normalizedName || item.name)))
      if (pantry.length && !matchedPantry.length) continue
      if (options.requireAllIngredients && pantry.length && matchedPantry.length < pantry.length) continue
      const matchedIngredients = (recipe.ingredients || [])
        .filter((item) => pantry.some((value) => this.ingredientMatches(value, item.normalizedName || item.name)))
        .map((item) => item.name)
      const missingIngredients = (recipe.ingredients || [])
        .filter((item) => item.required && item.role !== '调味料' && !pantry.some((value) => this.ingredientMatches(value, item.normalizedName || item.name)))
        .map((item) => item.name)
      const pantryCoverage = pantry.length ? matchedPantry.length / pantry.length : 1
      const requiredIngredients = (recipe.ingredients || []).filter((item) => item.required && item.role !== '调味料')
      const requiredMatchedCount = requiredIngredients.length - missingIngredients.length
      const recipeCoverage = pantry.length && requiredIngredients.length ? Math.max(0, requiredMatchedCount / requiredIngredients.length) : 1
      const timeScore = maxDuration ? Math.max(0, 1 - Math.max(0, recipe.durationMinutes - maxDuration) / Math.max(maxDuration, 1)) : 1
      const difficultyScore = difficulty ? (recipe.difficulty === difficulty ? 1 : 0.4) : 1
      const tasteScore = taste && (recipe.taste || []).some((value) => this.normalizeText(value).includes(taste)) ? 1 : taste ? 0.3 : 1
      const queryScore = query
        ? (this.normalizeIngredient(recipe.name) === query ? 1 : searchable.includes(query) ? 0.9 : 0.7)
        : 0
      const semanticScore = query ? queryScore : (semanticScores.get(recipe.id) ?? 0.55)
      const missingPenalty = Math.min(missingIngredients.length * 0.03, 0.18)
      const total = pantryCoverage * 0.28 + recipeCoverage * 0.2 + semanticScore * 0.2 + timeScore * 0.1 + difficultyScore * 0.05 + tasteScore * 0.04 + Number(recipe.quality?.score || 0.8) * 0.13 - missingPenalty
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

  private buildSearchCacheKey(options: NormalizedSearchOptions) {
    return JSON.stringify({
      ingredients: [...options.ingredients].map((value) => this.normalizeIngredient(value)).sort(),
      query: this.normalizeIngredient(options.query),
      allowEmpty: options.allowEmpty === true,
      requireAllIngredients: options.requireAllIngredients === true,
      maxDuration: Number(options.maxDuration || 0),
      difficulty: `${options.difficulty || ''}`,
      taste: this.normalizeText(options.taste),
      avoidances: [...options.avoidances].map((value) => this.normalizeIngredient(value)).sort(),
      excludeNames: [...options.excludeNames].map((value) => this.normalizeText(value)).sort(),
      limit: options.limit,
      model: this.embeddingModel,
      dimensions: this.embeddingDimensions,
    })
  }

  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      cache.delete(key)
      return null
    }
    cache.delete(key)
    cache.set(key, entry)
    return entry.value
  }

  private setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
    cache.delete(key)
    cache.set(key, { value, expiresAt: Date.now() + ttlMs })
    while (cache.size > this.cacheMaxEntries) {
      const oldestKey = cache.keys().next().value
      if (oldestKey === undefined) break
      cache.delete(oldestKey)
    }
  }

  private cloneHits(hits: RecipeKnowledgeHit[]) {
    return hits.map((hit) => ({
      ...hit,
      matchedIngredients: [...hit.matchedIngredients],
      missingIngredients: [...hit.missingIngredients],
    }))
  }

  private async withTimeout<T>(promise: Promise<T>, route: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${route} 召回超时`)), this.routeTimeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private uniqueStrings(values: unknown[]) {
    return [...new Set(values.map((value) => `${value || ''}`.trim()).filter(Boolean))]
  }
}
