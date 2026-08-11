const TEMPLATE_PATTERNS = [
  /本步骤操作要求[:：]?/gu,
  /[，,；;]?完成后进入下一步[。.]?/gu,
  /详情内容不完整/gu,
  /按菜式需要/gu,
  /准备并清洗所有食材/gu,
  /(?:方法|方案)[一二三四五六七八九十]\s*[:：]?/gu,
  /\*\*/gu,
  /shimmer/giu,
  /\d+\s*s\b/giu,
]

const REJECTED_TEXT_PATTERNS = [
  /详情内容不完整|按菜式需要|二选一|如何判断|shimmer|\*\*/iu,
  /(?:方法|方案)[一二三四五六七八九十]\s*[:：]/u,
]

const ACTION_RULES = [
  ['焯水', /焯|汆/u],
  ['蒸', /蒸|上汽/u],
  ['炖', /炖|煲/u],
  ['焖', /焖/u],
  ['煮', /煮|烧开|煮沸|沸腾/u],
  ['翻炒', /翻炒|煸炒|快炒|炒至|炒香|炒匀/u],
  ['煎', /煎|锅贴/u],
  ['炸', /油炸|炸至|复炸/u],
  ['烤', /烤箱|烘烤|烤制/u],
  ['腌制', /腌|腌制|抓匀/u],
  ['搅拌', /搅拌|拌匀|混合|调匀/u],
  ['切配', /切成|切片|切块|切丝|切丁|去皮|洗净|清洗/u],
  ['调味', /调味|加盐|放盐|加糖|放糖/u],
  ['收汁', /收汁/u],
  ['装盘', /装盘|盛出|出锅|装饰/u],
  ['浸泡', /浸泡|泡发/u],
  ['冷藏', /冷藏|冷却|冰镇/u],
  ['调制', /倒入杯|加入杯|摇匀|点火/u],
]

const METHOD_BY_ACTION = {
  焯水: '焯', 蒸: '蒸', 炖: '炖', 焖: '焖', 煮: '煮', 翻炒: '炒', 煎: '煎', 炸: '炸',
  烤: '烤', 腌制: '腌', 搅拌: '拌', 切配: '切配', 调味: '调味', 收汁: '炒', 装盘: '装盘',
  浸泡: '浸泡', 冷藏: '冷藏', 调制: '调制',
}

const INGREDIENT_ALIASES = {
  西红柿: '番茄', 马铃薯: '土豆', 洋芋: '土豆', 葱花: '小葱', 葱段: '小葱', 葱丝: '小葱', 葱白: '小葱',
  姜片: '生姜', 姜丝: '生姜', 姜末: '生姜', 蒜瓣: '大蒜', 蒜末: '大蒜', 蒜泥: '大蒜',
  鸡胸: '鸡胸肉', 鸡脯肉: '鸡胸肉', 鸡丁: '鸡肉', 猪肉末: '猪肉', 肉末: '猪肉',
  猪里脊: '猪肉', 里脊肉: '猪肉', 五花肉: '猪肉', 牛里脊: '牛肉', 牛腩: '牛肉', 肥牛: '牛肉',
  基围虾: '虾', 明虾: '虾', 白虾: '虾', 虾仁: '虾', 嫩豆腐: '豆腐', 老豆腐: '豆腐', 北豆腐: '豆腐',
  油麦菜: '生菜', 西芹: '芹菜', 意大利面: '面条', 意面: '面条', 挂面: '面条', 乌冬面: '面条',
  食盐: '盐', 白砂糖: '白糖', 植物油: '食用油', 色拉油: '食用油', 菜籽油: '食用油', 花生油: '食用油',
}

const UNIT_ALIASES = {
  g: '克', G: '克', kg: '千克', KG: '千克', 公斤: '千克', ml: '毫升', ML: '毫升', mL: '毫升',
  l: '升', L: '升', 大匙: '汤匙', 小匙: '茶匙', 匙: '勺', 枚: '个', 粒: '颗',
}

const COOKWARE_RULES = [
  ['炒锅', /炒锅|锅中|热锅|下锅|锅内|锅里/u],
  ['汤锅', /汤锅/u], ['砂锅', /砂锅/u], ['蒸锅', /蒸锅|上锅蒸|蒸制/u],
  ['烤箱', /烤箱|烘烤/u], ['平底锅', /平底锅|煎锅/u], ['电饭煲', /电饭煲|电饭锅/u],
  ['料理机', /料理机|搅拌机|破壁机/u], ['碗', /碗中|碗里|放入碗/u], ['杯', /杯中|杯口|海波杯/u],
  ['刀', /切成|切片|切块|切丝|切丁|剁碎/u],
]

const SEASONING_PATTERN = /盐|糖|油|醋|酱|料酒|酒|胡椒|孜然|辣椒粉|淀粉|味精|鸡精|香料|桂皮|八角|花椒|蚝油|蜂蜜|汁$/u

// These operations act only on equipment or present the finished dish. They do
// not consume a recipe ingredient, so forcing an Ingredient edge would create a
// false relationship in the graph. Food operations such as resting, covering,
// reducing and chilling are intentionally not exempt: they must point back to
// the ingredients contained in the food being handled.
export function isIngredientFreeStep(step) {
  const action = `${step?.action || ''}`.trim()
  const description = `${step?.description || ''}`.trim()
  if (action === '装盘') return true
  if (action === '预热') return true
  if (/^(?:将)?(?:炒锅|平底锅|煎锅|不粘锅|汤锅|砂锅|蒸锅|烤箱|空气炸锅|微波炉)\S{0,18}(?:预热|加热)/u.test(description)) return true
  if (/^(?:将)?(?:烤箱|空气炸锅|微波炉)\S{0,18}(?:调至|设定|调整)(?:温度)?/u.test(description)) return true
  return false
}

export const canonicalText = (value) => `${value || ''}`.trim().toLowerCase().replace(/[\s，。、“”‘’'"（）()【】\[\]_-]+/gu, '')

export function normalizeIngredientName(value) {
  let name = `${value || ''}`.trim()
  name = name.replace(/^[约大概适量少许\s]+/u, '')
  name = name.replace(/^(?:[一二两三四五六七八九十半\d.]+)(?:个|只|块|根|颗|瓣|片|株|珠|把|条|份|杯|碗)\s*/u, '')
  name = name.replace(/[（(][^）)]*(?:切|去皮|去骨|洗净|约|可选)[^）)]*[）)]/gu, '')
  name = name.replace(/^(?:新鲜|冷冻|去皮|去骨)\s*/u, '').trim()
  const exact = INGREDIENT_ALIASES[name]
  if (exact) return exact
  return name
    .replace(/葱花|葱段|葱丝|葱白/gu, '小葱')
    .replace(/姜片|姜丝|姜末/gu, '生姜')
    .replace(/蒜瓣|蒜末|蒜泥/gu, '大蒜')
}

export function ingredientKey(value) {
  let text = canonicalText(normalizeIngredientName(value))
  for (const [from, to] of Object.entries(INGREDIENT_ALIASES)) {
    const source = canonicalText(from)
    if (text === source) text = canonicalText(to)
  }
  return text
}

export function normalizeUnit(value, quantity) {
  const unit = `${value || ''}`.trim()
  if (!unit) return quantity == null ? '适量' : '份'
  return UNIT_ALIASES[unit] || unit
}

export function cleanStepDescription(value) {
  let text = `${value || ''}`.replace(/\r?\n/gu, ' ').replace(/\s+/gu, ' ').trim()
  for (const pattern of TEMPLATE_PATTERNS) text = text.replace(pattern, '')
  text = text.replace(/[；;]+$/u, '。').replace(/[，,]+(?=。)/gu, '').replace(/。，/gu, '。').trim()
  if (text && !/[。！？!?]$/u.test(text)) text += '。'
  return text
}

export function inferActions(description) {
  return [...new Set(ACTION_RULES.filter(([, pattern]) => pattern.test(description)).map(([action]) => action))]
}

export function inferMethods(description, actions = inferActions(description)) {
  return [...new Set(actions.map((action) => METHOD_BY_ACTION[action] || action).filter(Boolean))]
}

export function inferHeat(description, current = null) {
  return ['中小火', '中高火', '大火', '中火', '小火', '微火'].find((item) => description.includes(item)) || current || null
}

export function inferTemperature(description, current = null) {
  const match = description.match(/(\d{2,3})\s*(?:摄氏度|℃|度)/u)
  const value = match ? Number(match[1]) : Number(current)
  return Number.isFinite(value) && value > 0 && value <= 300 ? value : null
}

export function inferCookware(description, recipeCookware = [], current = []) {
  const values = [...current]
  for (const [name, pattern] of COOKWARE_RULES) {
    if (!pattern.test(description)) continue
    const existing = recipeCookware.find((item) => item === name || (name.endsWith('锅') && item.endsWith('锅')) || (name === '杯' && item.includes('杯')))
    values.push(existing || name)
  }
  return [...new Set(values.filter(Boolean))]
}

function ingredientMentioned(description, ingredient) {
  const keys = [ingredient.name, ingredient.normalizedName, normalizeIngredientName(ingredient.name), normalizeIngredientName(ingredient.normalizedName)]
    .map(ingredientKey).filter((item) => item.length >= 1)
  const text = ingredientKey(description)
  if (keys.some((key) => text.includes(key))) return true
  const canonical = ingredientKey(ingredient.normalizedName || ingredient.name)
  if (canonical === '鸡胸肉' && /鸡丁|鸡肉/u.test(description)) return true
  if (canonical === '猪肉' && /肉末|肉馅|肉片|肉丝|肉丁|排骨|小排/u.test(description)) return true
  if (canonical === '牛肉' && /牛腩|牛肉片|牛肉丝|牛肉丁/u.test(description)) return true
  if (canonical === '虾' && /虾仁|虾肉|鲜虾/u.test(description)) return true
  if (canonical === '豆腐' && /豆腐/u.test(description)) return true
  return false
}

export function inferIngredientsUsed(description, ingredients, current = []) {
  const byKey = new Map()
  for (const ingredient of ingredients) {
    for (const value of [ingredient.name, ingredient.normalizedName]) byKey.set(ingredientKey(value), ingredient.name)
  }
  const resolved = current.map((value) => byKey.get(ingredientKey(value)) || value)
  for (const ingredient of ingredients) if (ingredientMentioned(description, ingredient)) resolved.push(ingredient.name)
  return [...new Set(resolved.filter((value) => byKey.has(ingredientKey(value))))]
}

function hasRejectedText(value) {
  return REJECTED_TEXT_PATTERNS.some((pattern) => pattern.test(value)) || /[？?]/u.test(value)
}

function issue(severity, code, message, path, autoFixed = false) {
  return { severity, code, message, path, autoFixed }
}

function createEmbeddingText(recipe) {
  const ingredients = recipe.ingredients.map((item) => `${item.name}${item.rawAmount || (item.quantity == null ? item.unit : `${item.quantity}${item.unit}`)}`).join('、')
  const stepSummary = recipe.steps.slice(0, 8).map((step) => step.description).join(' ')
  return `${recipe.name}，${recipe.category}，${recipe.cuisine}；主要食材：${ingredients}；烹饪方式：${recipe.methods.join('、')}；口味：${recipe.taste.join('、')}；步骤：${stepSummary}`
}

export function curateRecipe(source) {
  const recipe = structuredClone(source)
  const fixes = []
  recipe.ingredients = (recipe.ingredients || []).map((ingredient, index) => {
    const name = normalizeIngredientName(ingredient.name)
    const normalizedName = normalizeIngredientName(ingredient.normalizedName || name)
    const quantity = Number.isFinite(Number(ingredient.quantity)) && Number(ingredient.quantity) > 0 ? Number(ingredient.quantity) : null
    const unit = normalizeUnit(ingredient.unit, quantity)
    if (name !== ingredient.name || normalizedName !== ingredient.normalizedName || unit !== ingredient.unit) {
      fixes.push(issue('info', 'INGREDIENT_NORMALIZED', `${ingredient.name} 已规范为 ${name}`, `ingredients[${index}]`, true))
    }
    return { ...ingredient, name, normalizedName, quantity, unit, rawAmount: `${ingredient.rawAmount || ''}`.trim() || (quantity == null ? unit : `${quantity}${unit}`) }
  }).filter((ingredient) => ingredient.name)

  const ingredientNames = new Set(recipe.ingredients.map((item) => item.name))
  recipe.cookware = [...new Set((recipe.cookware || []).map((item) => `${item || ''}`.trim()).filter(Boolean))]
  recipe.steps = (recipe.steps || []).map((step, index) => {
    const description = cleanStepDescription(step.description)
    const explicitAction = `${step.action || ''}`.trim()
    const actions = [...new Set([explicitAction, ...inferActions(description)].filter(Boolean))]
    const methods = [...new Set([...(step.methods || []).map((item) => `${item || ''}`.trim()), ...inferMethods(description, actions)].filter(Boolean))]
    const ingredientsUsed = inferIngredientsUsed(description, recipe.ingredients, step.ingredientsUsed || [])
    const cookwareUsed = inferCookware(description, recipe.cookware, step.cookwareUsed || [])
    for (const cookware of cookwareUsed) if (!recipe.cookware.includes(cookware)) recipe.cookware.push(cookware)
    if (description !== step.description) fixes.push(issue('info', 'STEP_TEMPLATE_CLEANED', `步骤 ${index + 1} 已清理模板文本`, `steps[${index}].description`, true))
    return {
      ...step,
      order: index + 1,
      title: `${step.title || ''}`.replace(/^制作步骤\s*\d+$/u, actions[0] || `步骤 ${index + 1}`),
      description,
      durationMinutes: Number.isFinite(Number(step.durationMinutes)) && Number(step.durationMinutes) > 0 ? Number(step.durationMinutes) : 1,
      heat: inferHeat(description, step.heat),
      temperatureCelsius: inferTemperature(description, step.temperatureCelsius),
      ingredientsUsed,
      cookwareUsed,
      action: actions[0] || null,
      methods,
    }
  }).filter((step) => step.description)

  recipe.methods = [...new Set([...(recipe.methods || []), ...recipe.steps.flatMap((step) => step.methods || [])].filter(Boolean))]
  recipe.embeddingText = createEmbeddingText(recipe)

  const issues = [...fixes]
  if (recipe.ingredients.length < 2) issues.push(issue('error', 'INGREDIENTS_INSUFFICIENT', '食材不足 2 项', 'ingredients'))
  if (recipe.steps.length < 2) issues.push(issue('error', 'STEPS_INSUFFICIENT', '有效步骤不足 2 步', 'steps'))
  const duplicateIngredients = recipe.ingredients.filter((item, index, all) => all.findIndex((other) => ingredientKey(other.normalizedName) === ingredientKey(item.normalizedName)) !== index)
  if (duplicateIngredients.length) issues.push(issue('error', 'INGREDIENT_DUPLICATE', `标准化后食材重复：${duplicateIngredients.map((item) => item.name).join('、')}`, 'ingredients'))

  for (const [index, ingredient] of recipe.ingredients.entries()) {
    if (ingredient.name.length > 20 || /[（(）)]|\/|或/u.test(ingredient.name)) issues.push(issue('error', 'INGREDIENT_NOT_ATOMIC', `食材名称不是原子字段：${ingredient.name}`, `ingredients[${index}].name`))
    if (ingredient.quantity == null && ingredient.role === '主料') {
      issues.push(issue('error', 'PRIMARY_INGREDIENT_QUANTITY_UNKNOWN', `主料数量未量化：${ingredient.name}（${ingredient.rawAmount}）`, `ingredients[${index}].quantity`))
    } else if (ingredient.quantity == null) {
      issues.push(issue('warning', 'INGREDIENT_QUANTITY_UNKNOWN', `食材使用定性用量：${ingredient.name}（${ingredient.rawAmount}）`, `ingredients[${index}].quantity`))
    }
  }

  const usedNames = new Set(recipe.steps.flatMap((step) => step.ingredientsUsed).map(ingredientKey))
  for (const [index, ingredient] of recipe.ingredients.entries()) {
    if (ingredient.role === '主料' && !usedNames.has(ingredientKey(ingredient.name))) {
      issues.push(issue('error', 'PRIMARY_INGREDIENT_UNUSED', `主料未在任何步骤中使用：${ingredient.name}`, `ingredients[${index}]`))
    } else if (!usedNames.has(ingredientKey(ingredient.name))) {
      issues.push(issue('error', 'INGREDIENT_UNUSED', `食材未在任何步骤中明确使用：${ingredient.name}`, `ingredients[${index}]`))
    }
  }

  for (const [index, step] of recipe.steps.entries()) {
    if (step.description.length < 8) issues.push(issue('error', 'STEP_TOO_SHORT', `步骤 ${index + 1} 描述过短`, `steps[${index}].description`))
    if (hasRejectedText(step.description)) issues.push(issue('error', 'STEP_INVALID_TEXT', `步骤 ${index + 1} 含模板、问句或异常文本`, `steps[${index}].description`))
    if (!step.action) issues.push(issue('error', 'STEP_ACTION_MISSING', `步骤 ${index + 1} 缺少明确动作`, `steps[${index}].action`))
    if (!step.methods.length) issues.push(issue('error', 'STEP_METHOD_MISSING', `步骤 ${index + 1} 缺少明确烹饪方式`, `steps[${index}].methods`))
    if (!step.ingredientsUsed.length && !isIngredientFreeStep(step)) issues.push(issue('error', 'STEP_INGREDIENTS_MISSING', `步骤 ${index + 1} 未关联食材`, `steps[${index}].ingredientsUsed`))
    if (['焯水', '蒸', '炖', '焖', '煮', '翻炒', '煎', '炸', '烤', '收汁'].includes(step.action) && !step.cookwareUsed.length) {
      issues.push(issue('error', 'STEP_COOKWARE_MISSING', `步骤 ${index + 1} 缺少厨具`, `steps[${index}].cookwareUsed`))
    }
    if (!Number.isFinite(step.durationMinutes) || step.durationMinutes <= 0) issues.push(issue('error', 'STEP_DURATION_INVALID', `步骤 ${index + 1} 时间无效`, `steps[${index}].durationMinutes`))
    for (const name of step.ingredientsUsed) if (!ingredientNames.has(name)) issues.push(issue('error', 'STEP_UNKNOWN_INGREDIENT', `步骤 ${index + 1} 引用了配料表外食材：${name}`, `steps[${index}].ingredientsUsed`))
  }

  const totalStepDuration = recipe.steps.reduce((sum, step) => sum + Number(step.durationMinutes || 0), 0)
  if (totalStepDuration > Number(recipe.durationMinutes || 0)) {
    const durationFix = issue('info', 'RECIPE_DURATION_RECALCULATED', `总用时已按完整步骤由 ${recipe.durationMinutes} 分钟重算为 ${totalStepDuration} 分钟`, 'durationMinutes', true)
    fixes.push(durationFix)
    issues.push(durationFix)
    recipe.durationMinutes = totalStepDuration
  }

  const errorCount = issues.filter((item) => item.severity === 'error' && !item.autoFixed).length
  const warningCount = issues.filter((item) => item.severity === 'warning').length
  const knownQuantityRatio = recipe.ingredients.length ? recipe.ingredients.filter((item) => item.quantity != null).length / recipe.ingredients.length : 0
  const linkedStepRatio = recipe.steps.length ? recipe.steps.filter((step) => step.ingredientsUsed.length || isIngredientFreeStep(step)).length / recipe.steps.length : 0
  const score = Math.max(0, Math.min(1, 1 - errorCount * 0.12 - warningCount * 0.025 - (1 - knownQuantityRatio) * 0.08 - (1 - linkedStepRatio) * 0.12))
  const passed = errorCount === 0 && score >= 0.82
  const status = passed && source.quality?.status === 'human_verified' ? 'human_verified' : passed ? 'production_ready' : 'quarantined'
  recipe.quality = {
    ...recipe.quality,
    status,
    score: Number(score.toFixed(3)),
    version: Math.max(2, Number(recipe.quality?.version || 1) + 1),
    curationMethod: '规则化全量审计、食材与单位规范化、步骤语义补全、生产准入校验',
  }
  return {
    recipe,
    report: {
      id: recipe.id,
      name: recipe.name,
      originalStatus: source.quality?.status || 'unknown',
      status,
      score: recipe.quality.score,
      errorCount,
      warningCount,
      autoFixCount: fixes.length,
      metrics: { ingredientCount: recipe.ingredients.length, stepCount: recipe.steps.length, knownQuantityRatio: Number(knownQuantityRatio.toFixed(3)), linkedStepRatio: Number(linkedStepRatio.toFixed(3)) },
      issues,
    },
  }
}
