import { AiService } from './ai.service'
import { RecipeKnowledgeService } from '../recipe-knowledge/recipe-knowledge.service'

describe('AiService recipe knowledge loop', () => {
  let knowledge: RecipeKnowledgeService
  let service: AiService

  beforeEach(() => {
    knowledge = new RecipeKnowledgeService()
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } }
    service = new AiService(prisma as any, knowledge)
  })

  afterEach(async () => {
    await knowledge.onModuleDestroy()
  })

  it('returns knowledge-base summaries before calling text generation', async () => {
    const result = await service.generateRecipeList({
      userId: 1,
      ingredients: [{ name: '番茄', quantity: 2, unit: '个' }, { name: '鸡蛋', quantity: 3, unit: '个' }],
      cookingTime: 30,
      tastePreference: '家常',
      count: 3,
      summaryOnly: true,
    })
    expect(result.recipes).toHaveLength(3)
    expect(result.recipes[0].name).toBe('番茄炒蛋')
    expect(result.recipes.every((recipe) => recipe.knowledgeId && recipe.retrievalSource)).toBe(true)
  })

  it('returns the stored full steps for a selected knowledge recipe', async () => {
    const detail = await service.generateRecipeDetail({
      userId: 1,
      recipe: { id: 'task_result_1', knowledgeId: 'recipe_0001', name: '番茄炒蛋' },
    })
    expect(detail.name).toBe('番茄炒蛋')
    expect(detail.steps.length).toBeGreaterThan(1)
    expect(detail.detailReady).toBe(true)
  })

  it('enriches and caches nutrition before returning a knowledge recipe detail', async () => {
    const nutritionCall = jest.spyOn(service as any, 'callDashScope').mockResolvedValue(JSON.stringify({
      nutrition: {
        calories: 328,
        protein: 22.4,
        fat: 18.6,
        carbohydrates: 19.2,
        fiber: 3.1,
        sodium: 620,
        analysis: '蛋白质较丰富，搭配蔬菜可提供膳食纤维。',
      },
    }))
    const detail = await service.generateRecipeDetail({
      userId: 1,
      recipe: { knowledgeId: 'recipe_0320', name: '西葫芦炒鸡蛋' },
    })
    expect(detail.ingredients.length).toBeGreaterThan(0)
    expect(detail.steps.length).toBeGreaterThan(1)
    expect(detail.detailReady).toBe(true)
    expect(detail.nutrition?.calories).toBe(328)

    const cachedDetail = await service.generateRecipeDetail({
      userId: 1,
      recipe: { knowledgeId: 'recipe_0320', name: '西葫芦炒鸡蛋' },
    })
    expect(cachedDetail.nutrition?.calories).toBe(328)
    expect(nutritionCall).toHaveBeenCalledTimes(1)
  })

  it('completes the asynchronous recommendation task from knowledge data', async () => {
    const task = service.createRecipeGenerateTask({
      userId: 1,
      ingredients: [{ name: '番茄' }, { name: '鸡蛋' }],
      cookingTime: 30,
      count: 6,
    })
    let snapshot = service.getRecipeGenerateTask(task.taskId)
    for (let attempt = 0; attempt < 20 && snapshot?.status !== 'done'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10))
      snapshot = service.getRecipeGenerateTask(task.taskId)
    }
    expect(snapshot?.status).toBe('done')
    expect(snapshot?.recipes).toHaveLength(6)
    expect(snapshot?.recipes.every((recipe) => recipe.retrievalSource)).toBe(true)
  })
})
