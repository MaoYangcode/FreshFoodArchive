# 菜谱知识库

本目录按批次保存结构化菜谱。前 60 道是原创结构化数据，后续批次由“厨房计划”公开 API 导入。校验器会自动聚合所有 `recipes.*.json` 文件并进行全库去重与一致性检查。

“厨房计划”数据采用 MIT 许可；每条导入记录均保留来源 ID、链接、许可、原始用量和推算字段清单。来源没有提供的营养信息保持为 `null`，不会生成伪营养值。

## 文件

- `recipes.sample.json`：第一批 20 道样例菜谱。
- `recipes.batch-02.json`：第二批扩充菜谱。
- `recipes.batch-03.json`：第三批扩充菜谱。
- `recipes.batch-04-proj-kitchen.json` 起：从第 61 道开始的“厨房计划”导入数据。
- `proj-kitchen-import-report.json`：导入数量和去重明细。
- `recipe.schema.json`：正式数据结构和字段约束。
- `neo4j-import.cypher`：以 `$recipes` 参数导入 Neo4j 的幂等查询。
- `../../scripts/validate-recipe-knowledge.mjs`：跨字段质量校验器。

## 质量状态

- `machine_validated`：原创整理数据，已通过结构和跨字段规则校验；营养值为每人份估算值。
- `source_validated`：开源来源数据，已完成格式转换、去重和规则校验，但尚未逐条人工复核；来源未提供的营养数据为 `null`。
- `human_verified`：已经人工逐条复核。

## 重新导入厨房计划

先把 `/api/recipes` 保存为索引 JSON，并将每道 `/api/recipes/{id}` 保存到同一个详情目录，然后在 `server` 目录执行：

```bash
npm run import:proj-kitchen -- --index /path/to/index.json --details /path/to/details
```

## 校验

在 `server` 目录执行：

```bash
npm run validate:recipes
```

校验内容包括：跨批次 ID 和菜名唯一、步骤编号连续、步骤食材和厨具引用有效、步骤累计用时不超过总用时、向量文本完整、营养与来源字段不伪造。

## Neo4j 映射

导入后形成以下核心关系：

```text
(Recipe)-[:USES]->(Ingredient)
(Recipe)-[:HAS_STEP]->(RecipeStep)
(Recipe)-[:USES_COOKWARE]->(Cookware)
(Recipe)-[:HAS_TASTE]->(Taste)
(Recipe)-[:USES_METHOD]->(CookingMethod)
(Recipe)-[:SUITABLE_FOR]->(DietTag)
(Recipe)-[:CONTAINS_ALLERGEN]->(Allergen)
```

生产导入使用项目脚本，它会建立图关系、全文索引和向量索引，并把完整 JSON 保存在 `Recipe.fullRecipeJson` 以便低延迟返回：

```bash
# 完整导入，并用 text-embedding-v4 生成向量
npm run sync:recipe-knowledge

# 没有向量 API Key 时，先完成图谱和关键词检索闭环
npm run sync:recipe-knowledge -- --skip-embeddings
```

后端检索顺序为：Neo4j 向量检索 → Neo4j 图谱食材检索 → 本地 JSON 混合检索。Neo4j 暂时不可用时会自动降级，不影响菜谱功能。
