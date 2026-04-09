"use strict";
const api_request = require("../request.js");
function getProfile(userId = 1) {
  return api_request.request({
    url: "/profile",
    method: "GET",
    data: { userId }
  });
}
function updateProfile(payload = {}) {
  return api_request.request({
    url: "/profile",
    method: "PUT",
    data: payload
  });
}
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/profile.js.map
