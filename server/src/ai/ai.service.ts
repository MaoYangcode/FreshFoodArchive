import { Injectable } from '@nestjs/common'

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

@Injectable()
export class AiService {
  private readonly apiKey = process.env.DASHSCOPE_API_KEY || ''
  private readonly endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  private readonly visionModel = process.env.DASHSCOPE_VISION_MODEL || 'qwen2.5-vl-7b-instruct'
  private readonly textModel = process.env.DASHSCOPE_TEXT_MODEL || 'qwen2.5-14b-instruct'
  private readonly allowMockFallback =
    `${process.env.AI_RECOGNIZE_FALLBACK_TO_MOCK || ''}`.trim() === '1'
  private readonly validCategories = new Set(['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'])

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

      return this.extractIngredientsFromResponse(content)
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
      const content = await this.callDashScope(this.visionModel, [
        { role: 'system', content: '你是结构化小票 OCR 助手。' },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ])

      return this.extractIngredientsFromResponse(content)
    } catch (error: any) {
      if (this.allowMockFallback) return this.mockRecognize()
      throw new Error(error?.message || '小票识别服务调用失败')
    }
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
      'steps 按实际烹饪需要返回，不限制步数；每一步都要具体可执行（包含关键动作或火候信息）。',
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
      steps: steps.length ? steps : ['准备并清洗食材。', '按顺序烹饪并调味后出锅。'],
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

    let response: Response
    try {
      response = await fetch(this.endpoint, {
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
      throw new Error(payload?.error?.message || `DashScope request failed: ${response.status}`)
    }

    return this.extractMessageText(payload?.choices?.[0]?.message?.content)
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
    try {
      return JSON.parse(raw)
    } catch (_) {
      const block =
        raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ||
        raw.match(/```[\s\S]*?```/i)?.[0]?.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim() ||
        raw.match(/\{[\s\S]*\}/)?.[0] ||
        raw.match(/\[[\s\S]*\]/)?.[0]
      if (!block) return {}
      try {
        return JSON.parse(block)
      } catch (_) {
        return {}
      }
    }
  }

  private extractIngredientsFromResponse(content: string): RecognizedIngredient[] {
    const parsed = this.parseJson(content)
    let list = this.pickIngredientArray(parsed)

    if (!list.length) {
      list = this.parseIngredientsFallback(content)
    }

    const normalized = list
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
      if (!t || t.length > 20) return false
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
    const rawName = `${item?.name || item?.ingredient || item?.food || item?.title || item?.名称 || item?.食材 || item?.品名 || ''}`.trim()
    const name = this.cleanIngredientName(rawName)
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
      .replace(/\b(x|X)\d+\b/g, ' ')
      .replace(/\d+(\.\d+)?(元|块|kg|g|ml|l|L|斤|两|个|盒|包|袋|瓶|罐|支|根)?/g, ' ')
      .replace(/[￥¥$]/g, ' ')
      .replace(/[：:;；，,。]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

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
