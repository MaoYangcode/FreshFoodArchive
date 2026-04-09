"use strict";
const api_request = require("../request.js");
function getShelfLifeSettings(userId = 1) {
  return api_request.request({
    url: "/shelf-life-settings",
    method: "GET",
    data: { userId }
  });
}
function updateShelfLifeSettings(payload = {}) {
  return api_request.request({
    url: "/shelf-life-settings",
    method: "PUT",
    data: payload
  });
}
exports.getShelfLifeSettings = getShelfLifeSettings;
exports.updateShelfLifeSettings = updateShelfLifeSettings;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/shelf-life.js.map
