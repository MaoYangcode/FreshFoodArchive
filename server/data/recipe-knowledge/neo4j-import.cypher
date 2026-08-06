// Run once during Neo4j initialization.
CREATE CONSTRAINT recipe_id_unique IF NOT EXISTS FOR (r:Recipe) REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT ingredient_name_unique IF NOT EXISTS FOR (i:Ingredient) REQUIRE i.normalizedName IS UNIQUE;
CREATE CONSTRAINT cookware_name_unique IF NOT EXISTS FOR (c:Cookware) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT taste_name_unique IF NOT EXISTS FOR (t:Taste) REQUIRE t.name IS UNIQUE;
CREATE CONSTRAINT method_name_unique IF NOT EXISTS FOR (m:CookingMethod) REQUIRE m.name IS UNIQUE;
CREATE CONSTRAINT diet_tag_name_unique IF NOT EXISTS FOR (d:DietTag) REQUIRE d.name IS UNIQUE;
CREATE CONSTRAINT allergen_name_unique IF NOT EXISTS FOR (a:Allergen) REQUIRE a.name IS UNIQUE;

// Reference import for graph relationships only. The supported production path is:
// npm run sync:recipe-knowledge
// It additionally stores fullRecipeJson and creates full-text/vector indexes.
// Pass one or more recipes.*.json arrays as the $recipes query parameter from the application.
UNWIND $recipes AS item
MERGE (recipe:Recipe {id: item.id})
SET recipe.name = item.name,
    recipe.aliases = item.aliases,
    recipe.category = item.category,
    recipe.cuisine = item.cuisine,
    recipe.difficulty = item.difficulty,
    recipe.durationMinutes = item.durationMinutes,
    recipe.servings = item.servings,
    recipe.tips = item.tips,
    recipe.suitableMeals = item.suitableMeals,
    recipe.embeddingText = item.embeddingText,
    recipe.qualityStatus = item.quality.status,
    recipe.qualityScore = item.quality.score,
    recipe.version = item.quality.version,
    recipe.nutritionCalories = item.nutritionPerServing.calories,
    recipe.nutritionProtein = item.nutritionPerServing.protein,
    recipe.nutritionFat = item.nutritionPerServing.fat,
    recipe.nutritionCarbohydrates = item.nutritionPerServing.carbohydrates,
    recipe.nutritionFiber = item.nutritionPerServing.fiber,
    recipe.nutritionSodium = item.nutritionPerServing.sodium,
    recipe.sourceProvider = item.source.provider,
    recipe.sourceRecipeId = item.source.sourceRecipeId,
    recipe.sourceUrl = item.source.url,
    recipe.sourceLicense = item.source.license
WITH recipe, item
CALL (recipe, item) {
  UNWIND item.ingredients AS value
  MERGE (ingredient:Ingredient {normalizedName: value.normalizedName})
  ON CREATE SET ingredient.name = value.normalizedName
  MERGE (recipe)-[rel:USES]->(ingredient)
  SET rel.displayName = value.name,
      rel.quantity = value.quantity,
      rel.unit = value.unit,
      rel.rawAmount = value.rawAmount,
      rel.role = value.role,
      rel.required = value.required,
      rel.substitutes = value.substitutes
}
CALL (recipe, item) {
  UNWIND item.cookware AS name
  MERGE (node:Cookware {name: name})
  MERGE (recipe)-[:USES_COOKWARE]->(node)
}
CALL (recipe, item) {
  UNWIND item.taste AS name
  MERGE (node:Taste {name: name})
  MERGE (recipe)-[:HAS_TASTE]->(node)
}
CALL (recipe, item) {
  UNWIND item.methods AS name
  MERGE (node:CookingMethod {name: name})
  MERGE (recipe)-[:USES_METHOD]->(node)
}
CALL (recipe, item) {
  UNWIND item.dietTags AS name
  MERGE (node:DietTag {name: name})
  MERGE (recipe)-[:SUITABLE_FOR]->(node)
}
CALL (recipe, item) {
  UNWIND item.allergens AS name
  MERGE (node:Allergen {name: name})
  MERGE (recipe)-[:CONTAINS_ALLERGEN]->(node)
}
CALL (recipe, item) {
  OPTIONAL MATCH (recipe)-[:HAS_STEP]->(oldStep:RecipeStep)
  DETACH DELETE oldStep
  WITH recipe, item
  UNWIND item.steps AS value
  CREATE (step:RecipeStep {
    recipeId: item.id,
    stepKey: item.id + '_' + toString(value.order),
    order: value.order,
    title: value.title,
    description: value.description,
    durationMinutes: value.durationMinutes,
    heat: value.heat,
    temperatureCelsius: value.temperatureCelsius,
    ingredientsUsed: value.ingredientsUsed,
    cookwareUsed: value.cookwareUsed
  })
  MERGE (recipe)-[:HAS_STEP]->(step)
}
RETURN count(recipe) AS importedRecipes;
