import { Injectable } from '@nestjs/common'

type RecognizedIngredient = {
  name: string
  category: string
  confidence?: number
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

@Injectable()
export class AiService {
  private readonly apiKey = process.env.DASHSCOPE_API_KEY || ''
  private readonly endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  private readonly visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen2.5-vl-7b-instruct'
  private readonly textModel = process.env.DASHSCOPE_TEXT_MODEL || 'qwen2.5-14b-instruct'

  async recognizeIngredientFromImage(file: any): Promise<RecognizedIngredient[]> {
    if (!this.apiKey) {
      return this.mockRecognize()
    }

    const mimeType = file?.mimetype || 'image/jpeg'
    const imageBase64 = file?.buffer?.toString('base64')
    if (!imageBase64) return []

    const prompt = [
      '请识别图片中的食材，只返回 JSON，不要额外文本。',
      'JSON 结构：{"ingredients":[{"name":"食材名","category":"类别","confidence":0.95}]}',
      'category 仅可取：蔬菜、水果、肉类、蛋奶、调料、其他。',
      'confidence 范围是 0 到 1，可选。',
      '如果无法识别，返回 {"ingredients":[]}',
    ].join('\n')

    const dataUrl = `data:${mimeType};base64,${imageBase64}`
    const content = await this.callDashScope(this.visionModel, [
      { role: 'system', content: '你是食材识别助手。' },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ])

    const parsed = this.parseJson(content)
    const list = Array.isArray(parsed?.ingredients) ? parsed.ingredients : []
    return list
      .map((item: any) => ({
        name: `${item?.name || ''}`.trim(),
        category: `${item?.category || '其他'}`.trim() || '其他',
        confidence: Number.isFinite(Number(item?.confidence))
          ? Number(Number(item.confidence).toFixed(2))
          : undefined,
      }))
      .filter((x: RecognizedIngredient) => !!x.name)
  }

  async generateRecipeList(payload: any): Promise<GeneratedRecipe[]> {
    const ingredients = Array.isArray(payload?.ingredients) ? payload.ingredients : []
    const count = Math.min(Math.max(Number(payload?.count || 3), 1), 6)
    const cookingTime = Number(payload?.cookingTime || 30)
    const tastePreference = `${payload?.tastePreference || '家常'}`

    if (!ingredients.length) return []
    if (!this.apiKey) {
      return this.mockRecipes(ingredients, count)
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

    const prompt = [
      '你是家庭烹饪助手。仅返回 JSON，不要附带解释文本。',
      '请根据给定食材生成菜谱候选列表。',
      `口味偏好：${tastePreference}`,
      `期望总烹饪时长（分钟）：${cookingTime}`,
      `候选数量：${count}`,
      `食材：${ingredientText}`,
      'JSON 结构：',
      '{"recipes":[{"id":"ai_001","name":"菜名","duration":15,"difficulty":"简单","matchScore":95,"coverImage":"","ingredients":[{"name":"番茄","quantity":2,"unit":"个"}],"steps":["步骤1","步骤2"],"tips":"可选"}]}',
      'difficulty 仅可取：简单、中等、困难。',
      'matchScore 范围 0-100。',
      'steps 至少 2 步。',
      '如果无法生成，返回 {"recipes":[]}',
    ].join('\n')

    const content = await this.callDashScope(
      this.textModel,
      [
        { role: 'system', content: '你是结构化 JSON 菜谱生成助手。' },
        { role: 'user', content: prompt },
      ],
      true,
    )

    const parsed = this.parseJson(content)
    const list = Array.isArray(parsed?.recipes) ? parsed.recipes : []
    return list
      .map((item: any, idx: number) => this.normalizeRecipe(item, idx))
      .filter((x: GeneratedRecipe) => !!x.name && Array.isArray(x.steps) && x.steps.length > 0)
      .slice(0, count)
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
      steps: steps.length ? steps : ['准备食材。', '加热烹饪后调味出锅。'],
      tips: `${item?.tips || ''}`.trim(),
    }
  }

  private async callDashScope(model: string, messages: any[], forceJson = false): Promise<string> {
    const body: any = {
      model,
      messages,
      temperature: 0.2,
    }
    if (forceJson) {
      body.response_format = { type: 'json_object' }
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error?.message || `DashScope request failed: ${response.status}`)
    }

    return `${payload?.choices?.[0]?.message?.content || ''}`.trim()
  }

  private parseJson(raw: string): any {
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch (_) {
      const block = raw.match(/```json\s*([\s\S]*?)```/i)?.[1] || raw.match(/\{[\s\S]*\}/)?.[0]
      if (!block) return {}
      try {
        return JSON.parse(block)
      } catch (_) {
        return {}
      }
    }
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
