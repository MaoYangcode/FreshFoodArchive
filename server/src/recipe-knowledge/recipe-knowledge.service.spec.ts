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
})
