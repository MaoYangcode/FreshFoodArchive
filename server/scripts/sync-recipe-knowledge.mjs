import 'dotenv/config'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import neo4j from 'neo4j-driver'

const args = new Set(process.argv.slice(2))
const skipEmbeddings = args.has('--skip-embeddings')
const uri = `${process.env.NEO4J_URI || ''}`.trim()
const user = `${process.env.NEO4J_USER || 'neo4j'}`.trim()
const password = `${process.env.NEO4J_PASSWORD || ''}`
const database = `${process.env.NEO4J_DATABASE || 'neo4j'}`.trim()
const apiKey = `${process.env.DASHSCOPE_API_KEY || ''}`.trim()
const embeddingEndpoint = `${process.env.DASHSCOPE_EMBEDDING_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings'}`.trim()
const embeddingModel = `${process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v4'}`.trim()
const dimensions = Math.max(64, Math.min(2048, Number(process.env.DASHSCOPE_EMBEDDING_DIMENSIONS || 1024)))
const dataDirectory = resolve(process.env.RECIPE_KNOWLEDGE_DIR || 'data/recipe-knowledge')

if (!uri || !password) throw new Error('请先配置 NEO4J_URI、NEO4J_USER 和 NEO4J_PASSWORD')
if (!skipEmbeddings && !apiKey) throw new Error('生成向量需要 DASHSCOPE_API_KEY；只导入图数据可加 --skip-embeddings')

const files = (await readdir(dataDirectory)).filter((name) => /^recipes\..+\.json$/u.test(name)).sort()
const recipes = (await Promise.all(files.map(async (name) => JSON.parse(await readFile(resolve(dataDirectory, name), 'utf8'))))).flat()
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))

async function embed(texts) {
  const response = await fetch(embeddingEndpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: embeddingModel, input: texts, dimensions }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `向量接口失败：HTTP ${response.status}`)
  const values = (payload?.data || []).slice().sort((a, b) => Number(a.index) - Number(b.index)).map((item) => item.embedding)
  if (values.length !== texts.length) throw new Error('向量接口返回数量不完整')
  return values
}

try {
  await driver.verifyConnectivity()
  await driver.executeQuery('CREATE CONSTRAINT recipe_id_unique IF NOT EXISTS FOR (r:Recipe) REQUIRE r.id IS UNIQUE', {}, { database })
  await driver.executeQuery('CREATE CONSTRAINT ingredient_name_unique IF NOT EXISTS FOR (i:Ingredient) REQUIRE i.normalizedName IS UNIQUE', {}, { database })
  await driver.executeQuery('CREATE CONSTRAINT cookware_name_unique IF NOT EXISTS FOR (c:Cookware) REQUIRE c.name IS UNIQUE', {}, { database })
  await driver.executeQuery("CREATE FULLTEXT INDEX recipe_fulltext_index IF NOT EXISTS FOR (r:Recipe) ON EACH [r.name, r.aliasText, r.embeddingText]", {}, { database })
  if (!skipEmbeddings) {
    await driver.executeQuery(
      `CREATE VECTOR INDEX recipe_embedding_index IF NOT EXISTS FOR (r:Recipe) ON (r.embedding)
       OPTIONS {indexConfig: {\`vector.dimensions\`: ${dimensions}, \`vector.similarity_function\`: 'cosine'}}`,
      {},
      { database },
    )
  }

  const batchSize = 10
  for (let offset = 0; offset < recipes.length; offset += batchSize) {
    const batch = recipes.slice(offset, offset + batchSize)
    const embeddings = skipEmbeddings ? batch.map(() => null) : await embed(batch.map((recipe) => recipe.embeddingText))
    const values = batch.map((recipe, index) => ({
      ...recipe,
      fullRecipeJson: JSON.stringify(recipe),
      nutritionJson: recipe.nutritionPerServing ? JSON.stringify(recipe.nutritionPerServing) : null,
      sourceJson: recipe.source ? JSON.stringify(recipe.source) : null,
      ingredientNames: recipe.ingredients.flatMap((item) => [item.name, item.normalizedName]),
      aliasText: (recipe.aliases || []).join(' '),
      embedding: embeddings[index],
      embeddingModel: embeddings[index] ? embeddingModel : null,
      embeddingDimensions: embeddings[index] ? dimensions : null,
    }))

    await driver.executeQuery(
      `UNWIND $recipes AS item
       MERGE (recipe:Recipe {id: item.id})
       SET recipe.name = item.name,
           recipe.aliases = item.aliases,
           recipe.aliasText = item.aliasText,
           recipe.category = item.category,
           recipe.cuisine = item.cuisine,
           recipe.taste = item.taste,
           recipe.methods = item.methods,
           recipe.difficulty = item.difficulty,
           recipe.durationMinutes = item.durationMinutes,
           recipe.servings = item.servings,
           recipe.tips = item.tips,
           recipe.dietTags = item.dietTags,
           recipe.allergens = item.allergens,
           recipe.suitableMeals = item.suitableMeals,
           recipe.embeddingText = item.embeddingText,
           recipe.ingredientNames = item.ingredientNames,
           recipe.qualityStatus = item.quality.status,
           recipe.qualityScore = item.quality.score,
           recipe.version = item.quality.version,
           recipe.nutritionJson = coalesce(item.nutritionJson, recipe.nutritionJson),
           recipe.sourceJson = item.sourceJson,
           recipe.fullRecipeJson = item.fullRecipeJson,
           recipe.embedding = coalesce(item.embedding, recipe.embedding),
           recipe.embeddingModel = coalesce(item.embeddingModel, recipe.embeddingModel),
           recipe.embeddingDimensions = coalesce(item.embeddingDimensions, recipe.embeddingDimensions)`,
      { recipes: values },
      { database },
    )

    const ids = batch.map((recipe) => recipe.id)
    await driver.executeQuery(
      `MATCH (recipe:Recipe) WHERE recipe.id IN $ids
       OPTIONAL MATCH (recipe)-[rel:USES|USES_COOKWARE|HAS_TASTE|USES_METHOD|SUITABLE_FOR|CONTAINS_ALLERGEN]->()
       DELETE rel`,
      { ids },
      { database },
    )
    await driver.executeQuery(
      `MATCH (recipe:Recipe)-[:HAS_STEP]->(step:RecipeStep) WHERE recipe.id IN $ids
       DETACH DELETE step`,
      { ids },
      { database },
    )
    await driver.executeQuery(
      `UNWIND $recipes AS item MATCH (recipe:Recipe {id: item.id})
       UNWIND item.ingredients AS value
       MERGE (ingredient:Ingredient {normalizedName: value.normalizedName})
       ON CREATE SET ingredient.name = value.normalizedName
       MERGE (recipe)-[rel:USES]->(ingredient)
       SET rel.displayName = value.name, rel.quantity = value.quantity, rel.unit = value.unit,
           rel.rawAmount = value.rawAmount, rel.role = value.role, rel.required = value.required,
           rel.substitutes = value.substitutes`,
      { recipes: batch },
      { database },
    )
    await driver.executeQuery(
      `UNWIND $recipes AS item MATCH (recipe:Recipe {id: item.id})
       UNWIND item.cookware AS name MERGE (node:Cookware {name: name}) MERGE (recipe)-[:USES_COOKWARE]->(node)`,
      { recipes: batch },
      { database },
    )
    for (const [field, label, relation] of [['taste', 'Taste', 'HAS_TASTE'], ['methods', 'CookingMethod', 'USES_METHOD'], ['dietTags', 'DietTag', 'SUITABLE_FOR'], ['allergens', 'Allergen', 'CONTAINS_ALLERGEN']]) {
      await driver.executeQuery(
        `UNWIND $recipes AS item MATCH (recipe:Recipe {id: item.id})
         UNWIND item.${field} AS name MERGE (node:${label} {name: name}) MERGE (recipe)-[:${relation}]->(node)`,
        { recipes: batch },
        { database },
      )
    }
    await driver.executeQuery(
      `UNWIND $recipes AS item MATCH (recipe:Recipe {id: item.id})
       UNWIND item.steps AS value
       CREATE (step:RecipeStep {
         recipeId: item.id, stepKey: item.id + '_' + toString(value.order), order: value.order,
         title: value.title, description: value.description, durationMinutes: value.durationMinutes,
         heat: value.heat, temperatureCelsius: value.temperatureCelsius,
         ingredientsUsed: value.ingredientsUsed, cookwareUsed: value.cookwareUsed
       })
       MERGE (recipe)-[:HAS_STEP]->(step)`,
      { recipes: batch },
      { database },
    )
    console.log(`已同步 ${Math.min(offset + batch.length, recipes.length)}/${recipes.length}`)
  }
  console.log(`菜谱知识库同步完成：${recipes.length} 道，向量=${skipEmbeddings ? '跳过' : `${embeddingModel}/${dimensions}维`}`)
} finally {
  await driver.close()
}
