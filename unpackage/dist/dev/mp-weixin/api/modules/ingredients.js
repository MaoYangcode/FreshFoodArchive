"use strict";
const api_request = require("../request.js");
function unwrapListPayload(source) {
  if (Array.isArray(source))
    return source;
  if (source && Array.isArray(source.data))
    return source.data;
  if (source && source.data && Array.isArray(source.data.data))
    return source.data.data;
  return [];
}
function getIngredientList(params = {}) {
  return api_request.request({
    url: "/ingredients",
    method: "GET",
    data: params
  });
}
function createIngredient(payload) {
  return api_request.request({
    url: "/ingredients",
    method: "POST",
    data: payload
  });
}
function updateIngredient(id, payload) {
  return api_request.request({
    url: `/ingredients/${id}`,
    method: "PATCH",
    data: payload
  });
}
function consumeIngredient(id, payload) {
  return api_request.request({
    url: `/ingredients/${id}/consume`,
    method: "POST",
    data: payload
  });
}
function getTakeoutRecords() {
  return api_request.request({
    url: "/ingredients/takeout-records",
    method: "GET"
  });
}
async function getIngredientDetail(id) {
  try {
    return await api_request.request({
      url: `/ingredients/${id}`,
      method: "GET"
    });
  } catch (e) {
    const isNotFound = e && (e.statusCode === 404 || `${e.message || ""}`.includes("Cannot GET"));
    if (!isNotFound)
      throw e;
    const listRes = await getIngredientList();
    const list = unwrapListPayload(listRes);
    const current = list.find((item) => `${item.id}` === `${id}`);
    if (current)
      return current;
    throw e;
  }
}
function deleteIngredient(id) {
  return api_request.request({
    url: `/ingredients/${id}`,
    method: "DELETE"
  });
}
exports.consumeIngredient = consumeIngredient;
exports.createIngredient = createIngredient;
exports.deleteIngredient = deleteIngredient;
exports.getIngredientDetail = getIngredientDetail;
exports.getIngredientList = getIngredientList;
exports.getTakeoutRecords = getTakeoutRecords;
exports.updateIngredient = updateIngredient;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/ingredients.js.map
