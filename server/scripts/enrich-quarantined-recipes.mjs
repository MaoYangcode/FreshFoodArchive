import 'dotenv/config'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { curateRecipe } from './lib/recipe-governance.mjs'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1])
const dataDirectory = resolve(args.get('--data-dir') || 'data/recipe-knowledge-curated')
const reportDirectory = resolve(args.get('--report-dir') || 'data/recipe-knowledge-reports')
const checkpointDirectory = resolve(reportDirectory, 'enrichment-checkpoints')
const limit = Math.max(0, Number(args.get('--limit') || 0))
const concurrency = Math.max(1, Math.min(5, Number(args.get('--concurrency') || 2)))
const retryFailed = `${args.get('--retry-failed') || ''}` === 'true'
const force = `${args.get('--force') || ''}` === 'true'
const onlyIds = new Set(`${args.get('--only') || ''}`.split(',').map((item) => item.trim()).filter(Boolean))
const apiKey = `${process.env.DASHSCOPE_API_KEY || ''}`.trim()
const endpoint = `${process.env.DASHSCOPE_CHAT_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'}`.trim()
const model = `${process.env.DASHSCOPE_TEXT_MODEL || 'qwen-plus'}`.trim()
if (!apiKey) throw new Error('批量语义补全需要 DASHSCOPE_API_KEY')

const files = (await readdir(dataDirectory)).filter((name) => /^recipes\..+\.json$/u.test(name)).sort()
const loadedRecipes = (await Promise.all(files.map(async (name) => JSON.parse(await readFile(resolve(dataDirectory, name), 'utf8'))))).flat()
const allRecipes = loadedRecipes.map((recipe) => curateRecipe(recipe).recipe)
const candidates = allRecipes.filter((recipe) => (recipe.quality?.status === 'quarantined' || (force && onlyIds.has(recipe.id))) && (!onlyIds.size || onlyIds.has(recipe.id))).slice(0, limit || undefined)
await mkdir(checkpointDirectory, { recursive: true })

const SYSTEM_PROMPT = `你是菜谱知识库数据治理员。你的任务不是创作新菜，而是把给定菜谱修复成可验证的结构化数据。
必须遵守：
1. 保持 id、标准菜名、菜谱类别和来源不变；不得把菜替换成另一道菜。
2. 食材 name 必须是单一食材名称，不得夹带数量、括号说明、二选一或句子。
3. quantity 使用正数或 null；unit 使用克、毫升、个、片、根、瓣、勺、适量等合理单位；保留 rawAmount。
4. 步骤至少 2 步，按 1 开始连续编号。description 必须是可直接执行的陈述句，禁止问句、模板话术、占位符和“按需处理”等空话。
5. 每一步必须填写 action 和 methods；ingredientsUsed 只能使用配料表中的精确 name；cookwareUsed 只能使用 cookware 中的名称。除纯设备预热/调温和最终装盘外，每个步骤都必须在 ingredientsUsed 中列出当前正在处理的原始食材。
6. 步骤文字中出现的水、清水、高汤、淀粉水、蛋液、碗汁、腌料等不得成为“隐含食材”。基础液体必须进入配料表；中间混合物在后续被倒入或使用时，ingredientsUsed 必须再次列出它包含的全部原始食材。
7. 核心主料必须在步骤中实际使用。烹饪步骤要有合理 durationMinutes；所有步骤 durationMinutes 的总和不得超过菜谱 durationMinutes；只有需要加热的步骤才填写 heat；没有明确温度时 temperatureCelsius 必须为 null，不能写 0。
8. 可以补充使原菜成立所必需且在常见做法中明确的基础食材，但不能凭空改变菜式。
9. 只返回一个 JSON 对象，不要 Markdown，不要解释。`

function userPrompt(recipe, issues, attempt) {
  const compact = {
    id: recipe.id, name: recipe.name, aliases: recipe.aliases, category: recipe.category, cuisine: recipe.cuisine,
    taste: recipe.taste, methods: recipe.methods, difficulty: recipe.difficulty, durationMinutes: recipe.durationMinutes,
    servings: recipe.servings, ingredients: recipe.ingredients, cookware: recipe.cookware, steps: recipe.steps,
    tips: recipe.tips, dietTags: recipe.dietTags, allergens: recipe.allergens, suitableMeals: recipe.suitableMeals,
  }
  return `这是第 ${attempt} 次修复。当前严格校验问题：\n${issues.map((item) => `- ${item.code}: ${item.message}`).join('\n')}\n\n待修复菜谱：\n${JSON.stringify(compact)}`
}

async function callModel(recipe, issues, attempt) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt(recipe, issues, attempt) }],
      temperature: 0.1,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `语义补全接口失败：HTTP ${response.status}`)
  const content = `${payload?.choices?.[0]?.message?.content || ''}`.trim().replace(/^```json\s*/iu, '').replace(/\s*```$/u, '')
  if (!content) throw new Error('语义补全接口返回空内容')
  return JSON.parse(content)
}

function mergeProtectedFields(original, generated) {
  return {
    ...original,
    ...generated,
    id: original.id,
    name: original.name,
    category: original.category,
    source: original.source,
    nutritionPerServing: original.nutritionPerServing,
    quality: original.quality,
  }
}

async function enrichOne(original) {
  const checkpointPath = resolve(checkpointDirectory, `${original.id}.json`)
  let current = original
  if (existsSync(checkpointPath)) {
    const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'))
    const governedCheckpoint = curateRecipe(checkpoint.recipe)
    const refreshed = { recipe: governedCheckpoint.recipe, report: { ...governedCheckpoint.report, enrichment: checkpoint.report?.enrichment } }
    current = governedCheckpoint.recipe
    if (!force && governedCheckpoint.report.status === 'production_ready') return refreshed
    if (!force && !retryFailed) return refreshed
  }
  let governed = curateRecipe(current)
  const attempts = []
  for (let attempt = 1; attempt <= 3 && (governed.report.status !== 'production_ready' || (force && attempt === 1)); attempt += 1) {
    const blocking = governed.report.issues.filter((item) => item.severity !== 'info' && !item.autoFixed)
    try {
      const generated = await callModel(current, blocking, attempt)
      current = mergeProtectedFields(original, generated)
      governed = curateRecipe(current)
      attempts.push({ attempt, status: governed.report.status, score: governed.report.score, errors: governed.report.errorCount, warnings: governed.report.warningCount })
    } catch (error) {
      attempts.push({ attempt, error: error?.message || `${error}` })
    }
  }
  const checkpoint = { recipe: governed.recipe, report: { ...governed.report, enrichment: { model, attempts } } }
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`)
  return checkpoint
}

let nextIndex = 0
const completed = []
async function worker() {
  while (nextIndex < candidates.length) {
    const index = nextIndex++
    const recipe = candidates[index]
    const result = await enrichOne(recipe)
    completed.push(result)
    console.log(`[${completed.length}/${candidates.length}] ${recipe.id} ${recipe.name}: ${result.report.status} (${result.report.score})`)
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length || 1) }, worker))

const checkpointFiles = (await readdir(checkpointDirectory)).filter((name) => /^recipe_\d{4}\.json$/u.test(name))
const checkpoints = await Promise.all(checkpointFiles.map(async (name) => JSON.parse(await readFile(resolve(checkpointDirectory, name), 'utf8'))))
const checkpointById = new Map(checkpoints.map((item) => {
  const governed = curateRecipe(item.recipe)
  return [item.recipe.id, { recipe: governed.recipe, report: { ...governed.report, enrichment: item.report?.enrichment } }]
}))
const mergedRecipes = allRecipes.map((recipe) => checkpointById.get(recipe.id)?.recipe || recipe)
const mergedReports = mergedRecipes.map((recipe) => checkpointById.get(recipe.id)?.report || curateRecipe(recipe).report)
for (const report of mergedReports) {
  await writeFile(resolve(reportDirectory, `${report.id}.quality.json`), `${JSON.stringify(report, null, 2)}\n`)
}
const batchSize = 100
for (let offset = 0; offset < mergedRecipes.length; offset += batchSize) {
  const number = `${Math.floor(offset / batchSize) + 1}`.padStart(2, '0')
  await writeFile(resolve(dataDirectory, `recipes.curated-${number}.json`), `${JSON.stringify(mergedRecipes.slice(offset, offset + batchSize), null, 2)}\n`)
}
const ready = mergedReports.filter((item) => ['production_ready', 'human_verified'].includes(item.status))
const graphStats = mergedRecipes.reduce((stats, recipe) => {
  stats.stepCount += recipe.steps.length
  stats.ingredientCount += recipe.ingredients.length
  for (const step of recipe.steps) {
    stats.stepIngredientEdges += step.ingredientsUsed?.length || 0
    stats.stepCookwareEdges += step.cookwareUsed?.length || 0
    stats.stepMethodEdges += step.methods?.length || 0
  }
  return stats
}, { stepCount: 0, ingredientCount: 0, stepIngredientEdges: 0, stepCookwareEdges: 0, stepMethodEdges: 0 })
const warningCounts = mergedReports.flatMap((item) => item.issues.filter((issue) => issue.severity === 'warning'))
  .reduce((counts, issue) => ({ ...counts, [issue.code]: (counts[issue.code] || 0) + 1 }), {})
const summary = {
  generatedAt: new Date().toISOString(), recipeCount: mergedRecipes.length,
  productionReadyCount: ready.length, quarantinedCount: mergedRecipes.length - ready.length,
  productionReadyRatio: Number((ready.length / Math.max(mergedRecipes.length, 1)).toFixed(3)),
  humanVerifiedCount: mergedReports.filter((item) => item.status === 'human_verified').length,
  graphStats,
  warningCounts,
  qualityGates: [
    '食材名称原子化且标准化', '主料数量必须量化', '配料表中的每项食材必须被步骤使用',
    '每个食品操作步骤必须关联原始食材', '步骤必须包含动作、烹饪方式、时间与所需厨具',
    '禁止模板话术、问句、异常单位和隐藏基础液体',
  ],
  semanticEnrichment: { model, checkpointCount: checkpoints.length, processedThisRun: completed.length },
}
await writeFile(resolve(reportDirectory, 'enrichment-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
await writeFile(resolve(reportDirectory, 'quality-report.enriched.json'), `${JSON.stringify(mergedReports, null, 2)}\n`)
console.log(`语义补全完成：本次 ${completed.length}，累计 ${checkpoints.length}，可生产 ${ready.length}/${mergedRecipes.length}`)
