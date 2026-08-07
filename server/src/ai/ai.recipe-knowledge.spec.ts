import { AiService } from './ai.service'
import { RecipeKnowledgeService } from '../recipe-knowledge/recipe-knowledge.service'

const nutrition = {
  calories: 328,
  protein: 22.4,
  fat: 18.6,
  carbohydrates: 19.2,
  fiber: 3.1,
  sodium: 620,
  analysis: '蛋白质较丰富，搭配蔬菜可提供膳食纤维。',
}

function summary(name: string, ingredients: Array<{ name: string; quantity: number; unit: string }>) {
  return { name, duration: 20, difficulty: '简单', ingredients, ingredientSetLocked: true, ingredientSetVersion: 2 }
}

function detail(name = '番茄炒蛋') {
  return {
    name,
    duration: 18,
    difficulty: '简单',
    servings: 2,
    ingredients: [
      { name: '番茄', quantity: 2, unit: '个' },
      { name: '鸡蛋', quantity: 3, unit: '个' },
      { name: '食用油', quantity: 15, unit: '毫升' },
      { name: '食盐', quantity: 2, unit: '克' },
    ],
    steps: [
      '番茄洗净后切成小块，鸡蛋打入碗中充分搅散。',
      '锅中加入食用油，中火加热至油面微微发亮，倒入鸡蛋炒至凝固后盛出。',
      '原锅放入番茄，中火翻炒约2分钟至出汁，再加入炒好的鸡蛋。',
      '加入食盐翻炒约30秒，使鸡蛋均匀裹上番茄汁后关火装盘。',
    ],
    tips: '鸡蛋刚凝固时先盛出，回锅后口感更嫩。',
    nutrition,
  }
}

describe('AiService recipe RAG loop', () => {
  let knowledge: RecipeKnowledgeService
  let service: AiService

  beforeEach(() => {
    knowledge = new RecipeKnowledgeService()
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } }
    service = new AiService(prisma as any, knowledge)
    ;(service as any).apiKey = 'test-key'
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await knowledge.onModuleDestroy()
  })

  it('uses retrieved knowledge as model context instead of returning it directly', async () => {
    const modelCall = jest.spyOn(service as any, 'callDashScope').mockResolvedValue(
      JSON.stringify({
        recipes: [
          summary('番茄炒鸡蛋盖饭', [
            { name: '番茄', quantity: 2, unit: '个' },
            { name: '鸡蛋', quantity: 2, unit: '个' },
            { name: '米饭', quantity: 300, unit: '克' },
          ]),
          summary('西红柿鸡蛋汤', [
            { name: '西红柿', quantity: 2, unit: '个' },
            { name: '鸡蛋', quantity: 1, unit: '个' },
          ]),
          summary('番茄鸡蛋面', [
            { name: '番茄', quantity: 1, unit: '个' },
            { name: '鸡蛋', quantity: 1, unit: '个' },
            { name: '面条', quantity: 150, unit: '克' },
          ]),
        ],
      }),
    )

    const result = await service.generateRecipeList({
      userId: 1,
      ingredients: [
        { name: '番茄', quantity: 2, unit: '个' },
        { name: '鸡蛋', quantity: 3, unit: '个' },
      ],
      cookingTime: 30,
      tastePreference: '家常',
      count: 3,
      summaryOnly: true,
      allowMockFallback: false,
    })

    expect(result.recipes).toHaveLength(3)
    expect(result.recipes[0].name).toBe('番茄炒鸡蛋盖饭')
    expect(result.recipes.every((recipe) => recipe.retrievalSource?.startsWith('rag-model:'))).toBe(true)
    expect(modelCall).toHaveBeenCalledTimes(1)
    expect(modelCall.mock.calls[0][1][1].content).toContain('知识库检索')
  })

  it('grounds change-batch names in RAG results and keeps seasonings out of the recipe focus', async () => {
    const groundedDocument = (knowledge as any).recipes.find((recipe: any) =>
      (recipe.ingredients || []).some((item: any) => `${item?.normalizedName || item?.name || ''}`.includes('番茄')),
    )
    expect(groundedDocument).toBeTruthy()
    jest.spyOn(knowledge, 'search').mockResolvedValue([
      {
        recipe: groundedDocument,
        score: 10,
        matchedIngredients: ['番茄'],
        missingIngredients: [],
        retrievalMode: 'local-hybrid',
      },
    ])
    const groundedIngredients = groundedDocument.ingredients.map((item: any) => ({
      name: item.name,
      quantity: Number(item.quantity || 1),
      unit: item.unit || '克',
    }))
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(
        JSON.stringify({
          recipes: [
            summary('胡椒番茄土豆羹', [
              { name: '番茄', quantity: 2, unit: '个' },
              { name: '土豆', quantity: 1, unit: '个' },
              { name: '胡椒粉', quantity: 1, unit: '克' },
            ]),
          ],
        }),
      )
      .mockResolvedValueOnce(JSON.stringify({ recipes: [summary(groundedDocument.name, groundedIngredients)] }))

    const result = await service.generateRecipeList({
      userId: 1,
      ingredients: [
        { name: '番茄', quantity: 2, unit: '个', category: '蔬菜' },
        { name: '胡椒粉', quantity: 1, unit: '袋', category: '调味品' },
        { name: '食用油', quantity: 1, unit: '瓶', category: '调味品' },
      ],
      cookingTime: 30,
      count: 1,
      summaryOnly: true,
      allowMockFallback: false,
      excludeNames: ['上一批菜谱'],
      groundNamesToKnowledge: true,
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.recipes).toHaveLength(1)
    expect(result.recipes[0].name).toBe(groundedDocument.name)
    const firstPrompt = modelCall.mock.calls[0][1][1].content
    expect(firstPrompt).toContain('优先使用的主要食材：番茄2个')
    expect(firstPrompt).toContain('家中现有调味料')
    expect(firstPrompt).toContain('胡椒粉1袋')
    expect(firstPrompt).toContain('菜名必须直接选自知识库检索参考')
  })

  it('always asks the model to generate final steps from knowledge references', async () => {
    const modelCall = jest.spyOn(service as any, 'callDashScope').mockResolvedValue(
      JSON.stringify({
        recipe: { steps: detail().steps, tips: detail().tips },
      }),
    )
    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: {
        knowledgeId: 'recipe_0001',
        name: '番茄炒蛋',
        ingredients: detail().ingredients,
        ingredientSetLocked: true,
        ingredientSetVersion: 2,
      },
    })

    expect(result.steps).toHaveLength(4)
    expect(result.detailReady).toBe(false)
    expect(result.retrievalSource?.startsWith('rag-model:')).toBe(true)
    expect(modelCall).toHaveBeenCalledTimes(1)
    expect(modelCall.mock.calls[0][1][1].content).toContain('最终版本')
    expect(modelCall.mock.calls[0][1][1].content).toContain('只生成 steps 与 tips')
    expect(modelCall.mock.calls[0][1][1].content).toContain('已锁定菜谱计划')
    expect((modelCall.mock.calls[0][1][1].content.match(/\[参考\d+\]/g) || []).length).toBeLessThanOrEqual(3)
    expect(modelCall.mock.calls[0][4]).toBe(1800)
  })

  it('keeps the version 2 ingredient contract unchanged while generating steps', async () => {
    const lockedIngredients = [
      { name: '番茄', quantity: 2, unit: '个' },
      { name: '鸡蛋', quantity: 3, unit: '个' },
      { name: '食用油', quantity: 15, unit: '毫升' },
      { name: '食盐', quantity: 2, unit: '克' },
    ]
    const modelCall = jest.spyOn(service as any, 'callDashScope').mockResolvedValue(
      JSON.stringify({
        recipe: {
          ingredients: [{ name: '番茄', quantity: 99, unit: '个' }],
          usedIngredients: ['番茄', '鸡蛋', '食用油', '食盐'],
          steps: detail().steps,
          tips: '鸡蛋不要炒得过老。',
        },
      }),
    )

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: summary('番茄炒蛋', lockedIngredients),
    })

    expect(result.ingredients.find((item) => item.name === '番茄')?.quantity).toBe(2)
    expect(result.ingredients.find((item) => item.name === '鸡蛋')?.quantity).toBe(3)
    expect(result.ingredients.find((item) => item.name === '食用油')?.quantity).toBe(15)
    expect(result.ingredientSetLocked).toBe(true)
    expect(result.ingredientSetVersion).toBe(2)
    expect(modelCall).toHaveBeenCalledTimes(1)
  })

  it('retries only the steps when a detail response uses an undeclared ingredient', async () => {
    const lockedIngredients = [
      { name: '番茄', quantity: 2, unit: '个' },
      { name: '鸡蛋', quantity: 3, unit: '个' },
      { name: '食盐', quantity: 2, unit: '克' },
    ]
    const correctedSteps = ['番茄洗净切块，鸡蛋打入碗中并充分搅散。', '锅中加入少量清水，倒入鸡蛋加热至凝固。', '加入番茄翻炒至出汁，与鸡蛋翻拌均匀。', '加入食盐调味，汤汁收至合适后关火。']
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(
        JSON.stringify({
          recipe: {
            usedIngredients: ['番茄', '鸡蛋', '食盐', '淀粉'],
            steps: [...correctedSteps.slice(0, 3), '加入淀粉和食盐调味后关火。'],
            tips: '鸡蛋不要炒得过老。',
          },
        }),
      )
      .mockResolvedValueOnce(JSON.stringify({ recipe: { usedIngredients: ['番茄', '鸡蛋', '食盐'], steps: correctedSteps, tips: '按食材状态调整火候。' } }))

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: summary('番茄炒蛋', lockedIngredients),
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.steps).toEqual(correctedSteps)
    expect(result.ingredients.some((item) => item.name === '淀粉')).toBe(false)
  })

  it('upgrades an old incomplete recipe contract once before generating steps', async () => {
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(
        JSON.stringify({
          recipe: { plan: { dishType: '汤羹', cookingMethod: '煮', requiredIngredients: ['番茄', '豆腐'] }, ingredients: [{ name: '番茄', quantity: 3, unit: '个' }, { name: '豆腐', quantity: 200, unit: '克' }, { name: '鸡蛋', quantity: 2, unit: '个' }, { name: '淀粉', quantity: 5, unit: '克' }, { name: '食盐', quantity: 3, unit: '克' }] },
        }),
      )
      .mockResolvedValueOnce(JSON.stringify({ recipe: { usedIngredients: ['番茄', '豆腐', '鸡蛋', '淀粉', '食盐'], steps: ['番茄洗净切丁，豆腐切块，鸡蛋充分搅散。', '锅中加水烧开，放入番茄和豆腐煮至番茄变软。', '淋入鸡蛋液，待蛋花凝固后用淀粉水勾芡。', '加入食盐调味，汤汁稍稠后关火。'], tips: '淀粉水要分次加入。' } }))

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: { name: '番茄豆腐羹', duration: 20, difficulty: '简单', ingredients: [{ name: '番茄', quantity: 3, unit: '个' }] },
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.ingredients.some((item) => item.name.includes('豆腐'))).toBe(true)
    expect(result.ingredientSetVersion).toBe(2)
    expect(result.contractUpgraded).toBe(true)
    expect(result.steps.length).toBeGreaterThanOrEqual(3)
  })

  it('automatically writes an omitted optional seasoning into the steps', async () => {
    const ingredients = [
      { name: '茄子', quantity: 2, unit: '个' },
      { name: '食用油', quantity: 20, unit: '毫升' },
      { name: '生抽', quantity: 10, unit: '毫升' },
      { name: '白糖', quantity: 5, unit: '克' },
    ]
    const modelCall = jest.spyOn(service as any, 'callDashScope').mockResolvedValue(
      JSON.stringify({
        recipe: {
          requiredIngredientAdditions: [],
          steps: ['茄子洗净切成滚刀块，放入清水中浸泡后沥干。', '锅中加入食用油烧热，放入茄子煎至表面微黄。', '沿锅边加入生抽，翻炒均匀后加少量清水烧至茄子软嫩。', '待汤汁逐渐收浓后翻拌均匀，关火装盘即可。'],
          tips: '茄子沥干后再下锅可以减少溅油。',
        },
      }),
    )

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: summary('红烧茄子', ingredients),
    })

    expect(modelCall).toHaveBeenCalledTimes(1)
    expect(result.steps.join('')).toContain('白糖')
  })

  it('rewrites optional undeclared ingredients instead of applying fixed ingredient defaults', async () => {
    const ingredients = [
      { name: '番茄', quantity: 2, unit: '个' },
      { name: '土豆', quantity: 1, unit: '个' },
      { name: '食用油', quantity: 5, unit: '毫升' },
      { name: '食盐', quantity: 2, unit: '克' },
      { name: '胡椒粉', quantity: 0.5, unit: '克' },
    ]
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(
        JSON.stringify({
          recipe: {
            usedIngredients: ['番茄', '土豆', '食用油', '淀粉', '食盐', '胡椒粉'],
            requiredIngredientAdditions: [],
            steps: [
              '番茄洗净切块，土豆去皮切成小块备用。',
              '土豆放入蒸锅，中火蒸约15分钟至能轻松压碎。',
              '番茄加入食用油翻炒至软烂出汁，再压成细腻的泥。',
              '将土豆泥与番茄泥混合，加入淀粉、食盐和胡椒粉拌匀后即可食用。',
            ],
            tips: '土豆蒸透后更容易压成细腻的泥。',
          },
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          recipe: {
            usedIngredients: ['番茄', '土豆', '食用油', '食盐', '胡椒粉'],
            steps: [
              '番茄洗净切块，土豆去皮切成小块备用。',
              '土豆放入蒸锅，中火蒸约15分钟至能轻松压碎。',
              '番茄加入食用油翻炒至软烂出汁，再压成细腻的泥。',
              '将土豆泥与番茄泥混合，加入食盐和胡椒粉拌匀后即可食用。',
            ],
            tips: '土豆蒸透后更容易压成细腻的泥。',
          },
        }),
      )

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: summary('蒸番茄土豆泥', ingredients),
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.ingredients.some((item) => item.name === '淀粉')).toBe(false)
    expect(result.steps.join('')).not.toContain('淀粉')
  })

  it('regenerates recommendation summaries when quantities or units are missing', async () => {
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(
        JSON.stringify({
          recipes: [summary('番茄炒蛋', [{ name: '番茄', quantity: 2, unit: '' }])],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          recipes: [
            summary('番茄炒蛋', [
              { name: '番茄', quantity: 2, unit: '个' },
              { name: '鸡蛋', quantity: 3, unit: '个' },
            ]),
          ],
        }),
      )

    const result = await service.generateRecipeList({
      userId: 1,
      ingredients: [{ name: '番茄' }, { name: '鸡蛋' }],
      cookingTime: 30,
      count: 1,
      summaryOnly: true,
      allowMockFallback: false,
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.recipes).toHaveLength(1)
    expect(result.recipes[0].ingredients.every((item) => item.quantity && item.unit)).toBe(true)
  })

  it('regenerates a named staple dish when its required staple is missing', async () => {
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(
        JSON.stringify({
          recipes: [
            summary('茄丁焖面', [
              { name: '茄子', quantity: 2, unit: '个' },
              { name: '番茄', quantity: 1, unit: '个' },
              { name: '食用油', quantity: 15, unit: '毫升' },
            ]),
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          recipes: [
            summary('茄丁焖面', [
              { name: '茄子', quantity: 2, unit: '个' },
              { name: '鲜面条', quantity: 240, unit: '克' },
              { name: '番茄', quantity: 1, unit: '个' },
              { name: '食用油', quantity: 15, unit: '毫升' },
            ]),
          ],
        }),
      )

    const result = await service.generateRecipeList({
      userId: 1,
      ingredients: [{ name: '茄子' }, { name: '番茄' }],
      cookingTime: 30,
      count: 1,
      summaryOnly: true,
      allowMockFallback: false,
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.recipes).toHaveLength(1)
    expect(result.recipes[0].ingredients.some((item) => /面/u.test(item.name))).toBe(true)
    expect(result.recipes[0].plan?.requiredIngredients.some((item) => /面/u.test(item))).toBe(true)
    expect(modelCall.mock.calls[1][1][1].content).toContain('局部修复')
    expect(modelCall.mock.calls[1][1][1].content).toContain('固定菜名：茄丁焖面')
  })

  it('repairs a missing core ingredient declared by the recipe plan', async () => {
    const planned = {
      ...summary('宫保鸡丁', [
        { name: '鸡胸肉', quantity: 300, unit: '克' },
        { name: '干辣椒', quantity: 8, unit: '克' },
      ]),
      plan: {
        dishType: '家常菜',
        cookingMethod: '炒',
        requiredIngredients: ['鸡胸肉', '花生米'],
      },
    }
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(JSON.stringify({ recipes: [planned] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          recipe: {
            plan: planned.plan,
            ingredients: [...planned.ingredients, { name: '花生米', quantity: 50, unit: '克' }],
          },
        }),
      )

    const result = await service.generateRecipeList({
      userId: 1,
      ingredients: [{ name: '鸡胸肉' }, { name: '干辣椒' }],
      cookingTime: 30,
      count: 1,
      summaryOnly: true,
      allowMockFallback: false,
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.recipes[0].name).toBe('宫保鸡丁')
    expect(result.recipes[0].ingredients.some((item) => item.name === '花生米')).toBe(true)
  })

  it('normalizes template wording and time units without regenerating the recipe', async () => {
    const ingredients = [
      { name: '番茄', quantity: 3, unit: '个' },
      { name: '土豆', quantity: 1, unit: '个' },
      { name: '米饭', quantity: 300, unit: '克' },
      { name: '食用油', quantity: 15, unit: '毫升' },
      { name: '食盐', quantity: 3, unit: '克' },
    ]
    const modelCall = jest.spyOn(service as any, 'callDashScope').mockResolvedValue(
      JSON.stringify({
        recipe: {
          usedIngredients: ingredients.map((item) => item.name),
          requiredIngredientAdditions: [],
          steps: [
            '**方法一：** 番茄洗净切块，土豆去皮切成小丁备用。',
            '本步骤操作要求：锅中加入食用油，中火加热后放入番茄和土豆翻炒2分钟。',
            '加入米饭翻拌均匀并加盖焖10分钟，如何判断熟度可观察土豆是否变软。',
            '最后加入食盐翻炒30 s，使味道均匀后关火，完成后进入下一步。',
          ],
          tips: '焖制时保持小火，避免锅底焦糊。',
        },
      }),
    )

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: summary('番茄土豆焖饭', ingredients),
    })

    expect(modelCall).toHaveBeenCalledTimes(1)
    expect(result.steps.join('')).not.toMatch(/本步骤操作要求|完成后进入下一步|如何判断|\*\*|30\s*s/u)
    expect(result.steps.join('')).toContain('30秒')
  })

  it('rejects template steps and retries before returning the detail', async () => {
    const bad = {
      ...detail('拔丝土豆'),
      steps: ['土豆切块后放入锅中炸熟。', '本步骤操作要求：取出土豆，完成后进入下一步。', '重新倒入土豆翻炒后装盘。'],
    }
    const good = {
      ...detail('拔丝土豆'),
      ingredients: [
        { name: '土豆', quantity: 400, unit: '克' },
        { name: '白砂糖', quantity: 80, unit: '克' },
        { name: '食用油', quantity: 500, unit: '毫升' },
        { name: '白芝麻', quantity: 5, unit: '克' },
      ],
      steps: [
        '土豆去皮切成约2厘米滚刀块，用厨房纸吸干表面水分。',
        '锅中加入食用油，中火加热至六成热，放入土豆炸约6分钟至表面金黄后捞出。',
        '另取干净锅加入白砂糖和20毫升清水，小火持续搅拌至糖浆呈浅琥珀色。',
        '迅速倒入炸好的土豆翻拌约20秒，使糖浆均匀裹住土豆。',
        '关火后撒入白芝麻翻匀，立即装盘并趁热食用。',
      ],
    }
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(JSON.stringify({ recipe: bad }))
      .mockResolvedValueOnce(JSON.stringify({ recipe: good }))

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: summary('拔丝土豆', [{ name: '土豆', quantity: 400, unit: '克' }]),
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.steps.join('')).not.toContain('本步骤操作要求')
    expect(result.detailReady).toBe(false)
  })

  it('rejects unnecessary mechanical measurements while keeping useful cooking parameters', async () => {
    const ingredients = [
      { name: '茄子', quantity: 5, unit: '个' },
      { name: '食用油', quantity: 15, unit: '毫升' },
      { name: '胡椒粉', quantity: 1, unit: '茶匙' },
    ]
    const bad = {
      ...detail('烤茄子'),
      ingredients,
      steps: [
        '将茄子洗净擦干，用叉子在每个茄子表面均匀扎8下。',
        '取15毫升食用油，均匀涂抹在5个茄子的整个表面。',
        '烤箱预热至200℃，将茄子烤约15分钟，直至按压可凹陷0.4厘米。',
        '取出茄子纵向划开一道长约9厘米、深约1.5厘米的切口。',
        '撒入1茶匙胡椒粉后放回烤箱，继续烤3分钟即可装盘。',
      ],
    }
    const good = {
      ...bad,
      steps: [
        '茄子洗净并擦干表面水分，用叉子均匀扎孔帮助受热。',
        '在茄子表面薄薄刷一层食用油，同时将烤箱预热至200℃。',
        '茄子放入烤箱中层烤约15分钟，烤至表皮起皱、按压明显变软。',
        '取出茄子纵向划开，用小刀轻轻拨松内部茄肉，但不要划破外皮。',
        '在切口处撒入胡椒粉，放回烤箱继续烤约3分钟，闻到香味后取出装盘。',
      ],
    }
    const modelCall = jest
      .spyOn(service as any, 'callDashScope')
      .mockResolvedValueOnce(JSON.stringify({ recipe: bad }))
      .mockResolvedValueOnce(JSON.stringify({ recipe: good }))

    const result = await service.generateRecipeSteps({
      userId: 1,
      recipe: summary('烤茄子', ingredients),
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(result.steps.join('')).not.toMatch(/扎8下|凹陷0\.4厘米|长约9厘米/)
    expect(result.steps.join('')).toContain('200℃')
    expect(result.steps.join('')).toContain('表皮起皱')
  })

  it('uses the finalized step ingredients when generating nutrition', async () => {
    let stepsFinishedAt = 0
    let nutritionFinishedAt = 0
    const modelCall = jest.spyOn(service as any, 'callDashScope').mockImplementation(async (_model, messages) => {
      const prompt = `${messages?.[1]?.content || ''}`
      if (prompt.includes('估算每人份营养数据')) {
        await new Promise((resolve) => setTimeout(resolve, 15))
        nutritionFinishedAt = Date.now()
        return JSON.stringify({ nutrition })
      }
      await new Promise((resolve) => setTimeout(resolve, 15))
      stepsFinishedAt = Date.now()
      return JSON.stringify({ recipe: detail() })
    })

    const result = await service.generateRecipeDetail({
      userId: 1,
      recipe: summary('番茄炒蛋', detail().ingredients),
    })

    expect(modelCall).toHaveBeenCalledTimes(2)
    expect(stepsFinishedAt).toBeGreaterThan(0)
    expect(nutritionFinishedAt).toBeGreaterThan(0)
    expect(nutritionFinishedAt).toBeGreaterThanOrEqual(stepsFinishedAt)
    expect(result.steps).toHaveLength(4)
    expect(result.nutrition?.calories).toBe(328)
    expect(result.detailReady).toBe(true)
  })

  it('completes the asynchronous task only with model-generated RAG summaries', async () => {
    let callIndex = 0
    const names = [
      ['番茄炒蛋盖饭', '西红柿鸡蛋汤'],
      ['番茄鸡蛋面', '鸡蛋番茄饼'],
      ['番茄蒸蛋', '番茄蛋花粥'],
    ]
    jest.spyOn(service as any, 'callDashScope').mockImplementation(async () => {
      const pair = names[Math.min(callIndex, names.length - 1)]
      callIndex += 1
      return JSON.stringify({
        recipes: pair.map((name) =>
          summary(name, [
            { name: '番茄', quantity: 1, unit: '个' },
            { name: '鸡蛋', quantity: 2, unit: '个' },
            ...(/面/u.test(name) ? [{ name: '面条', quantity: 150, unit: '克' }] : []),
            ...(/盖饭|炒饭|焖饭|烩饭|拌饭|饭团|煲仔饭/u.test(name) ? [{ name: '米饭', quantity: 200, unit: '克' }] : []),
            ...(/粥/u.test(name) ? [{ name: '大米', quantity: 100, unit: '克' }] : []),
          ]),
        ),
      })
    })

    const task = service.createRecipeGenerateTask({
      userId: 1,
      ingredients: [{ name: '番茄' }, { name: '鸡蛋' }],
      cookingTime: 30,
      count: 6,
    })
    let snapshot = service.getRecipeGenerateTask(task.taskId)
    for (let attempt = 0; attempt < 40 && snapshot?.status !== 'done'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10))
      snapshot = service.getRecipeGenerateTask(task.taskId)
    }
    expect(snapshot?.status).toBe('done')
    expect(snapshot?.recipes).toHaveLength(6)
    expect(snapshot?.recipes.every((recipe) => recipe.retrievalSource?.startsWith('rag-model:'))).toBe(true)
  })
})
