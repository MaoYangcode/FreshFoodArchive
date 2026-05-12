"use strict";
const api_request = require("../request.js");
function recommendRecipes(payload) {
  return api_request.request({
    url: "/ai/generate-recipe",
    method: "POST",
    data: payload,
    timeout: 9e4
  });
}
exports.recommendRecipes = recommendRecipes;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/recipes.js.map
