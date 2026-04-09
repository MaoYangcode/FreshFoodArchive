"use strict";
const api_request = require("../request.js");
function recommendRecipes(payload) {
  return api_request.request({
    url: "/ai/generate-recipe",
    method: "POST",
    data: payload
  });
}
exports.recommendRecipes = recommendRecipes;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/recipes.js.map
