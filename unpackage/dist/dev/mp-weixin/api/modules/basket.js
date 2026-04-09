"use strict";
const api_request = require("../request.js");
function getBasketItems(userId = 1) {
  return api_request.request({
    url: "/basket-items",
    method: "GET",
    data: { userId }
  });
}
function addBasketItem(payload = {}) {
  return api_request.request({
    url: "/basket-items",
    method: "POST",
    data: payload
  });
}
function upsertBasketItems(items = [], sourceRecipeName = "", userId = 1) {
  return api_request.request({
    url: "/basket-items/upsert",
    method: "POST",
    data: {
      userId,
      items,
      sourceRecipeName
    }
  });
}
function toggleBasketItemStatus(id, userId = 1) {
  return api_request.request({
    url: `/basket-items/${id}/toggle`,
    method: "PATCH",
    data: { userId }
  });
}
function removeBasketItem(id, userId = 1) {
  return api_request.request({
    url: `/basket-items/${id}?userId=${encodeURIComponent(userId)}`,
    method: "DELETE",
    data: {}
  });
}
function clearDoneBasketItems(userId = 1) {
  return api_request.request({
    url: `/basket-items/done/clear?userId=${encodeURIComponent(userId)}`,
    method: "DELETE",
    data: {}
  });
}
function restockDoneBasketItems(payload = {}) {
  return api_request.request({
    url: "/basket-items/done/restock",
    method: "POST",
    data: payload
  });
}
exports.addBasketItem = addBasketItem;
exports.clearDoneBasketItems = clearDoneBasketItems;
exports.getBasketItems = getBasketItems;
exports.removeBasketItem = removeBasketItem;
exports.restockDoneBasketItems = restockDoneBasketItems;
exports.toggleBasketItemStatus = toggleBasketItemStatus;
exports.upsertBasketItems = upsertBasketItems;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/basket.js.map
