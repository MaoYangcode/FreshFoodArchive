import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { curateRecipe } from './lib/recipe-governance.mjs'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1])
const sourceDirectory = resolve(args.get('--source-dir') || 'data/recipe-knowledge')
const outputDirectory = resolve(args.get('--output-dir') || 'data/recipe-knowledge-curated')
const reportDirectory = resolve(args.get('--report-dir') || 'data/recipe-knowledge-reports')
const batchSize = Math.max(10, Number(args.get('--batch-size') || 100))

const files = (await readdir(sourceDirectory)).filter((name) => /^recipes\..+\.json$/u.test(name)).sort()
const recipes = (await Promise.all(files.map(async (name) => JSON.parse(await readFile(resolve(sourceDirectory, name), 'utf8'))))).flat()
const governed = recipes.map(curateRecipe)
const curated = governed.map((item) => item.recipe)
const reports = governed.map((item) => item.report)
const ready = curated.filter((recipe) => recipe.quality.status === 'production_ready')
const quarantined = curated.filter((recipe) => recipe.quality.status === 'quarantined')

await rm(outputDirectory, { recursive: true, force: true })
await rm(reportDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })
await mkdir(resolve(reportDirectory, 'recipes'), { recursive: true })

for (let offset = 0; offset < curated.length; offset += batchSize) {
  const number = `${Math.floor(offset / batchSize) + 1}`.padStart(2, '0')
  await writeFile(resolve(outputDirectory, `recipes.curated-${number}.json`), `${JSON.stringify(curated.slice(offset, offset + batchSize), null, 2)}\n`)
}
for (const report of reports) await writeFile(resolve(reportDirectory, 'recipes', `${report.id}.json`), `${JSON.stringify(report, null, 2)}\n`)

const issueCounts = {}
for (const report of reports) for (const item of report.issues) issueCounts[item.code] = (issueCounts[item.code] || 0) + 1
const summary = {
  generatedAt: new Date().toISOString(),
  sourceDirectory,
  recipeCount: curated.length,
  productionReadyCount: ready.length,
  quarantinedCount: quarantined.length,
  productionReadyRatio: Number((ready.length / Math.max(curated.length, 1)).toFixed(3)),
  averageScore: Number((reports.reduce((sum, item) => sum + item.score, 0) / Math.max(reports.length, 1)).toFixed(3)),
  issueCounts: Object.fromEntries(Object.entries(issueCounts).sort((a, b) => b[1] - a[1])),
  productionReadyIds: ready.map((recipe) => recipe.id),
  quarantinedIds: quarantined.map((recipe) => recipe.id),
}
await writeFile(resolve(reportDirectory, 'initial-audit-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
await writeFile(resolve(reportDirectory, 'quality-report.json'), `${JSON.stringify(reports, null, 2)}\n`)
await writeFile(resolve(reportDirectory, 'quarantine.json'), `${JSON.stringify(reports.filter((item) => item.status === 'quarantined'), null, 2)}\n`)

console.log(`菜谱治理完成：总计 ${curated.length}，可生产 ${ready.length}，隔离 ${quarantined.length}，平均分 ${summary.averageScore}`)
console.log(`审计报告：${resolve(reportDirectory, 'summary.json')}`)
