import { RecipeKnowledgeService } from './recipe-knowledge.service'

describe('RecipeKnowledgeService', () => {
  let service: RecipeKnowledgeService

  beforeEach(() => {
    service = new RecipeKnowledgeService()
  })

  afterEach(async () => {
    await service.onModuleDestroy()
  })

  it('loads all recipe batches and resolves an exact recipe', () => {
    expect(service.getStatus().recipeCount).toBe(379)
    const recipe = service.findByIdOrName('番茄炒蛋')
    expect(recipe?.id).toBe('recipe_0001')
    expect(recipe?.steps.length).toBeGreaterThan(1)
  })

  it('retrieves executable recipes from pantry ingredients', async () => {
    const hits = await service.search({ ingredients: ['番茄', '鸡蛋'], maxDuration: 30, limit: 6 })
    expect(hits.length).toBe(6)
    expect(hits[0].recipe.name).toBe('番茄炒蛋')
    expect(hits[0].matchedIngredients).toEqual(expect.arrayContaining(['番茄', '鸡蛋']))
    expect(hits.every((hit) => hit.recipe.durationMinutes <= 30)).toBe(true)
    expect(hits[0].retrievalMode).toBe('local-hybrid')
  })

  it('applies avoidance and exclusion filters before returning results', async () => {
    const hits = await service.search({
      ingredients: ['番茄', '鸡蛋'],
      avoidances: ['猪肉'],
      excludeNames: ['番茄炒蛋'],
      limit: 12,
    })
    expect(hits.some((hit) => hit.recipe.name === '番茄炒蛋')).toBe(false)
    expect(hits.some((hit) => hit.recipe.ingredients.some((item) => item.normalizedName.includes('猪肉')))).toBe(false)
  })

  it('keeps quarantined recipes out of direct answers while allowing weak-reference retrieval', async () => {
    const target = service.findByIdOrName('番茄炒蛋') as any
    const originalStatus = target.quality.status
    target.quality.status = 'quarantined'

    const direct = await service.search({ ingredients: ['番茄', '鸡蛋'], query: '番茄炒蛋', qualityScope: 'direct', limit: 12 })
    const reference = await service.search({ ingredients: ['番茄', '鸡蛋'], query: '番茄炒蛋', qualityScope: 'reference', limit: 12 })

    expect(direct.some((hit) => hit.recipe.id === target.id)).toBe(false)
    expect(reference.some((hit) => hit.recipe.id === target.id)).toBe(true)
    target.quality.status = originalStatus
  })

  it('fuses vector, graph and full-text candidates and caches identical searches', async () => {
    const recipes = ['番茄炒蛋', '番茄牛肉蛋花汤', '西红柿鸡蛋挂面']
      .map((name) => service.findByIdOrName(name))
      .filter(Boolean) as any[]
    const record = (recipe: any, score: number) => ({
      get: (key: string) => key === 'id' ? recipe.id : key === 'recipeJson' ? JSON.stringify(recipe) : score,
    })
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('vector.queryNodes')) return { records: [record(recipes[1], 0.91), record(recipes[0], 0.89)] }
      if (query.includes('MATCH (recipe:Recipe)-[:USES]')) return { records: [record(recipes[0], 2), record(recipes[2], 2)] }
      if (query.includes('fulltext.queryNodes')) return { records: [record(recipes[0], 4.2), record(recipes[1], 3.7)] }
      return { records: [] }
    })
    ;(service as any).neo4jUri = 'bolt://test'
    ;(service as any).neo4jPassword = 'test'
    ;(service as any).apiKey = 'test-key'
    ;(service as any).driver = { executeQuery, close: jest.fn() }
    const embeddingCall = jest.spyOn(service as any, 'createEmbeddings').mockResolvedValue([[0.1, 0.2]])

    const options = { ingredients: ['番茄', '鸡蛋'], taste: '家常', maxDuration: 30, limit: 3 }
    const first = await service.search(options)
    const second = await service.search(options)

    expect(first[0].recipe.name).toBe('番茄炒蛋')
    expect(first.every((hit) => hit.retrievalMode === 'neo4j-hybrid')).toBe(true)
    expect(second.map((hit) => hit.recipe.id)).toEqual(first.map((hit) => hit.recipe.id))
    expect(executeQuery).toHaveBeenCalledTimes(3)
    expect(embeddingCall).toHaveBeenCalledTimes(1)
    expect(service.getStatus().searchCacheEntries).toBe(1)
    expect(service.getStatus().embeddingCacheEntries).toBe(1)
  })

  it('falls back to the local knowledge base when all Neo4j routes fail', async () => {
    ;(service as any).neo4jUri = 'bolt://test'
    ;(service as any).neo4jPassword = 'test'
    ;(service as any).apiKey = 'test-key'
    ;(service as any).driver = {
      executeQuery: jest.fn().mockRejectedValue(new Error('database unavailable')),
      close: jest.fn(),
    }
    jest.spyOn(service as any, 'createEmbeddings').mockResolvedValue([[0.1, 0.2]])

    const hits = await service.search({ ingredients: ['番茄', '鸡蛋'], maxDuration: 30, limit: 3 })

    expect(hits).toHaveLength(3)
    expect(hits[0].retrievalMode).toBe('local-hybrid')
    expect(hits[0].recipe.name).toBe('番茄炒蛋')
  })
})
