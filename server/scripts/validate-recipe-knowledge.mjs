import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const dataDirectory = resolve(process.cwd(), 'data/recipe-knowledge')
const dataFiles = (await readdir(dataDirectory))
  .filter((name) => /^recipes\..+\.json$/.test(name))
  .sort()
const batches = await Promise.all(dataFiles.map(async (name) => {
  const value = JSON.parse(await readFile(resolve(dataDirectory, name), 'utf8'))
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${name} 必须是非空数组`)
  return { name, recipes: value }
}))
const recipes = batches.flatMap((batch) => batch.recipes)
const errors = []
const ids = new Set()
const names = new Set()
const sourceIds = new Set()
const allowedCategories = new Set(['热菜', '汤羹', '主食', '凉菜', '早餐', '轻食', '甜品', '饮品', '调味品', '半成品加工'])
const allowedDifficulties = new Set(['简单', '中等', '困难'])

const fail = (recipe, message) => errors.push(`${recipe?.id || '<unknown>'}: ${message}`)
const canonical = (value) => `${value || ''}`.trim().replace(/\s+/g, '').toLowerCase()

if (!Array.isArray(recipes) || recipes.length === 0) {
  throw new Error('菜谱文件必须是非空数组')
}

for (const recipe of recipes) {
  if (!/^recipe_\d{4}$/.test(recipe.id || '')) fail(recipe, 'id 格式错误')
  if (ids.has(recipe.id)) fail(recipe, 'id 重复')
  ids.add(recipe.id)

  if (!allowedCategories.has(recipe.category)) fail(recipe, `分类不受支持：${recipe.category}`)
  if (!allowedDifficulties.has(recipe.difficulty)) fail(recipe, `难度不受支持：${recipe.difficulty}`)
  if (!Number.isFinite(recipe.durationMinutes) || recipe.durationMinutes <= 0) fail(recipe, '总用时必须为正数')
  if (!Number.isInteger(recipe.servings) || recipe.servings < 1) fail(recipe, '份数必须为正整数')

  const nameKey = canonical(recipe.name)
  if (!nameKey) fail(recipe, '菜名为空')
  if (names.has(nameKey)) fail(recipe, '菜名重复')
  names.add(nameKey)

  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 1) fail(recipe, '食材不足 1 项')
  if (!Array.isArray(recipe.steps) || recipe.steps.length < 2) fail(recipe, '步骤不足 2 步')
  if (!recipe.embeddingText || recipe.embeddingText.length < 30) fail(recipe, 'embeddingText 过短')
  if (recipe.nutritionPerServing !== null && recipe?.nutritionPerServing?.estimated !== true) fail(recipe, '营养信息必须标记为估算值；来源未提供时应为 null')
  if (recipe?.quality?.status === 'source_validated') {
    if (!recipe.source?.url || !recipe.source?.license || !recipe.source?.sourceRecipeId) fail(recipe, '来源校验数据必须包含来源链接、许可和来源 ID')
    if (recipe.nutritionPerServing !== null) fail(recipe, '来源未提供营养数据时不得生成伪估算值')
    const sourceKey = `${recipe.source.provider}:${recipe.source.sourceRecipeId}`
    if (sourceIds.has(sourceKey)) fail(recipe, `来源记录重复：${sourceKey}`)
    sourceIds.add(sourceKey)
    if (!Array.isArray(recipe.source.estimatedFields) || !recipe.source.estimatedFields.includes('servings')) fail(recipe, '来源未提供份数时必须标记为推算字段')
    for (const ingredient of recipe.ingredients || []) {
      if (!ingredient.rawAmount) fail(recipe, `来源配料缺少原始用量：${ingredient.name}`)
      if (ingredient.quantity !== null && (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0)) fail(recipe, `配料数量无效：${ingredient.name}`)
    }
  }

  const ingredientNames = new Set((recipe.ingredients || []).map((item) => canonical(item.name)))
  const cookwareNames = new Set((recipe.cookware || []).map(canonical))
  const stepOrders = (recipe.steps || []).map((step) => step.order)
  const expectedOrders = stepOrders.map((_, index) => index + 1)
  if (JSON.stringify(stepOrders) !== JSON.stringify(expectedOrders)) fail(recipe, '步骤编号必须从 1 连续递增')

  let stepDuration = 0
  for (const step of recipe.steps || []) {
    stepDuration += Number(step.durationMinutes || 0)
    if (`${step.description || ''}`.trim().length < 12) fail(recipe, `步骤 ${step.order} 描述过短`)
    for (const ingredient of step.ingredientsUsed || []) {
      if (!ingredientNames.has(canonical(ingredient))) fail(recipe, `步骤 ${step.order} 引用了配料表外食材：${ingredient}`)
    }
    for (const cookware of step.cookwareUsed || []) {
      if (!cookwareNames.has(canonical(cookware))) fail(recipe, `步骤 ${step.order} 引用了厨具表外厨具：${cookware}`)
    }
  }

  if (stepDuration > Number(recipe.durationMinutes || 0)) {
    fail(recipe, `步骤用时 ${stepDuration} 分钟超过总用时 ${recipe.durationMinutes} 分钟`)
  }

  const aliases = new Set((recipe.aliases || []).map(canonical))
  if (aliases.has(nameKey)) fail(recipe, '别名不能与标准菜名相同')
  if (!['machine_validated', 'source_validated', 'human_verified'].includes(recipe?.quality?.status)) fail(recipe, '数据质量状态不可入库')
}

const numericIds = [...ids].map((id) => Number(id.slice(-4))).sort((a, b) => a - b)
for (let index = 0; index < numericIds.length; index += 1) {
  if (numericIds[index] !== index + 1) errors.push(`全库编号不连续：期望 recipe_${`${index + 1}`.padStart(4, '0')}`)
}

if (errors.length) {
  console.error(`菜谱知识库校验失败，共 ${errors.length} 项：`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`菜谱知识库校验通过：${dataFiles.length} 个批次，${recipes.length} 道菜，${recipes.reduce((sum, item) => sum + item.steps.length, 0)} 个步骤。`)
}
