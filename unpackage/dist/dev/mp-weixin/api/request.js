"use strict";
const common_vendor = require("../common/vendor.js");
const utils_currentUser = require("../utils/current-user.js");
const DEFAULT_BASE_URL_CANDIDATES = [
  "https://nnvicode.com"
];
const BASE_URL_STORAGE_KEY = "FFA_API_BASE_URL";
function canUseUni() {
  return typeof common_vendor.index !== "undefined" && common_vendor.index && typeof common_vendor.index.request === "function";
}
function normalizeBaseUrl(url) {
  const text = `${url || ""}`.trim();
  if (!text)
    return "";
  return text.replace(/\/+$/, "");
}
function readBaseUrlFromStorage() {
  if (!canUseUni() || typeof common_vendor.index.getStorageSync !== "function")
    return "";
  try {
    return normalizeBaseUrl(common_vendor.index.getStorageSync(BASE_URL_STORAGE_KEY));
  } catch (e) {
    return "";
  }
}
function writeBaseUrlToStorage(value) {
  if (!canUseUni() || typeof common_vendor.index.setStorageSync !== "function" || value === void 0)
    return;
  try {
    common_vendor.index.setStorageSync(BASE_URL_STORAGE_KEY, value);
  } catch (e) {
  }
}
function dedupe(list) {
  const result = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item)
      continue;
    if (result.indexOf(item) !== -1)
      continue;
    result.push(item);
  }
  return result;
}
function getBaseCandidates() {
  const savedBase = readBaseUrlFromStorage();
  const list = savedBase ? [savedBase].concat(DEFAULT_BASE_URL_CANDIDATES) : DEFAULT_BASE_URL_CANDIDATES.slice();
  return dedupe(list);
}
let activeBaseUrl = getBaseCandidates()[0] || DEFAULT_BASE_URL_CANDIDATES[0];
function getActiveBaseUrl() {
  return activeBaseUrl;
}
function requestOnce(baseUrl, { url, method = "GET", data = {}, header = {}, timeout = 8e3 }) {
  return new Promise((resolve, reject) => {
    const safeUrl = `${url || ""}`.trim();
    const isAuthLogin = safeUrl === "/auth/wechat-login" || safeUrl.includes("/auth/wechat-login?");
    const pickToken = () => `${utils_currentUser.getAuthToken() || ""}`.trim();
    const waitForToken = (maxWaitMs = 5e3) => new Promise((resolveToken) => {
      const start = Date.now();
      const loop = () => {
        const current = pickToken();
        if (current) {
          resolveToken(current);
          return;
        }
        if (Date.now() - start >= maxWaitMs) {
          resolveToken("");
          return;
        }
        setTimeout(loop, 200);
      };
      loop();
    });
    const userId = utils_currentUser.getCurrentUserId();
    Promise.resolve(isAuthLogin ? "" : waitForToken()).then((token) => {
      if (!isAuthLogin && !token) {
        reject({
          code: 401,
          message: "请先完成微信登录"
        });
        return;
      }
      const headers = {
        ...token ? { Authorization: `Bearer ${token}` } : {},
        ...!isAuthLogin && userId > 0 ? { "x-user-id": String(userId) } : {},
        ...header
      };
      common_vendor.index.request({
        url: `${baseUrl}${url}`,
        method,
        data,
        header: headers,
        timeout,
        success: (res) => {
          const payload = res.data || {};
          const statusCode = Number((res == null ? void 0 : res.statusCode) || 0);
          if (statusCode < 200 || statusCode >= 300) {
            reject(payload);
            return;
          }
          if (payload.code === 0 || payload.code === void 0) {
            resolve(payload);
            return;
          }
          reject(payload);
        },
        fail: (err) => {
          reject(err);
        }
      });
    }).catch((err) => reject(err));
  });
}
function request({ url, method = "GET", data = {}, header = {}, timeout = 8e3 }) {
  const bases = getBaseCandidates();
  const orderedBases = dedupe([activeBaseUrl].concat(bases));
  const tryNext = (index, lastError) => {
    if (index >= orderedBases.length) {
      return Promise.reject(lastError || new Error("all base urls failed"));
    }
    const base = orderedBases[index];
    return requestOnce(base, { url, method, data, header, timeout }).then((payload) => {
      activeBaseUrl = base;
      writeBaseUrlToStorage(base);
      return payload;
    }).catch((err) => {
      const hasBizCode = err && typeof err === "object" && Object.prototype.hasOwnProperty.call(err, "code");
      if (hasBizCode)
        return Promise.reject(err);
      return tryNext(index + 1, err);
    });
  };
  return tryNext(0, null);
}
exports.getActiveBaseUrl = getActiveBaseUrl;
exports.request = request;
//# sourceMappingURL=../../.sourcemap/mp-weixin/api/request.js.map
