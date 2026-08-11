# 菜谱知识库治理报告

## 治理结果

- 菜谱总数：379
- 初次审计可直接使用：41
- 初次审计隔离：338
- 语义修复及严格复检后 `production_ready`：379
- 当前隔离：0
- `human_verified`：0（自动治理不会伪造人工审核状态）
- 步骤：3274
- 食材记录：3338
- `Step -> Ingredient`：8590
- `Step -> Cookware`：3841
- `Step -> CookingMethod`：5634

仍保留 28 条 `INGREDIENT_QUANTITY_UNKNOWN` 警告，均为“适量”“足量”等次要配料。主料数量、单位和步骤使用关系已经通过硬性校验。

完整机器可读结果见：

- `initial-audit-summary.json`：治理前的审计结果
- `enrichment-summary.json`：治理后的最终汇总
- `*.quality.json`：每道菜的独立质量报告

## 数据状态

- `human_verified`：确实由人工复核过，可直接回答。
- `production_ready`：通过自动严格校验，可直接回答。
- `quarantined`：未通过生产门槛，只能作为弱参考，不能直接展示给用户。

## 运行顺序

```bash
npm run govern:recipes
npm run enrich:recipes
npm run validate:recipes:curated
npm run sync:recipe-knowledge
```

前两条用于重新治理源数据。已经存在合格治理结果时，部署服务器通常只需执行校验和同步。同步命令会重新生成向量并更新 Neo4j；仅排查图关系时才使用 `npm run sync:recipe-knowledge -- --skip-embeddings`。

## 生产检索规则

- 用户直接查询和菜谱搜索只使用 `human_verified` 与 `production_ready`。
- `quarantined` 不会被直接返回，只能在生成阶段作为低权重参考。
- 图谱以菜谱、步骤、食材、厨具和烹饪方式为节点，保存步骤顺序以及步骤使用食材、厨具和烹饪方式的关系。
