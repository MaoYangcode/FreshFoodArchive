"use strict";
const common_vendor = require("../common/vendor.js");
const USER_ID_STORAGE_KEY = "currentUserId";
const AUTH_TOKEN_STORAGE_KEY = "ffaAuthToken";
function normalizeUserId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    return 0;
  return Math.floor(n);
}
function getCurrentUserId() {
  try {
    const raw = common_vendor.index.getStorageSync(USER_ID_STORAGE_KEY);
    return normalizeUserId(raw);
  } catch (_) {
    return 0;
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
function clearCurrentUserId() {
  try {
    common_vendor.index.removeStorageSync(USER_ID_STORAGE_KEY);
  } catch (_) {
  }
}
function normalizeToken(value) {
  return `${value || ""}`.trim();
}
function getAuthToken() {
  try {
    return normalizeToken(common_vendor.index.getStorageSync(AUTH_TOKEN_STORAGE_KEY));
  } catch (_) {
    return "";
  }
}
function setAuthToken(token) {
  const normalized = normalizeToken(token);
  try {
    common_vendor.index.setStorageSync(AUTH_TOKEN_STORAGE_KEY, normalized);
  } catch (_) {
  }
  return normalized;
}
function clearAuthToken() {
  try {
    common_vendor.index.removeStorageSync(AUTH_TOKEN_STORAGE_KEY);
  } catch (_) {
  }
}
exports.clearAuthToken = clearAuthToken;
exports.clearCurrentUserId = clearCurrentUserId;
exports.getAuthToken = getAuthToken;
exports.getCurrentUserId = getCurrentUserId;
exports.setAuthToken = setAuthToken;
exports.setCurrentUserId = setCurrentUserId;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/current-user.js.map
