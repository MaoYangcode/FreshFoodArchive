"use strict";
const api_request = require("../request.js");
function getExpiryReminderSettings(userId = 1) {
  return api_request.request({
    url: "/expiry-reminder/settings",
    method: "GET",
    data: { userId }
  });
}
function updateExpiryReminderSettings(payload = {}) {
  return api_request.request({
    url: "/expiry-reminder/settings",
    method: "PUT",
    data: payload
  });
}
exports.getExpiryReminderSettings = getExpiryReminderSettings;
exports.updateExpiryReminderSettings = updateExpiryReminderSettings;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/expiry-reminder.js.map
