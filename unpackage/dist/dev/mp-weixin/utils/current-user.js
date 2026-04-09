"use strict";
const common_vendor = require("../common/vendor.js");
const USER_ID_STORAGE_KEY = "currentUserId";
function normalizeUserId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    return 1;
  return Math.floor(n);
}
function getCurrentUserId() {
  try {
    const raw = common_vendor.index.getStorageSync(USER_ID_STORAGE_KEY);
    return normalizeUserId(raw);
  } catch (_) {
    return 1;
  }
}
function setCurrentUserId(userId) {
  const normalized = normalizeUserId(userId);
  try {
    common_vendor.index.setStorageSync(USER_ID_STORAGE_KEY, normalized);
  } catch (_) {
  }
  return normalized;
}
exports.getCurrentUserId = getCurrentUserId;
exports.setCurrentUserId = setCurrentUserId;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/current-user.js.map
