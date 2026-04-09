"use strict";
const common_vendor = require("../common/vendor.js");
const utils_currentUser = require("../utils/current-user.js");
const BASE_URL_CANDIDATES = [
  "http://192.168.10.215:3000",
  "http://172.20.10.10:3000"
];
let activeBaseUrl = BASE_URL_CANDIDATES[0];
function getActiveBaseUrl() {
  return activeBaseUrl;
}
function requestOnce(baseUrl, { url, method = "GET", data = {}, header = {} }) {
  return new Promise((resolve, reject) => {
    const userId = utils_currentUser.getCurrentUserId();
    const headers = {
      "x-user-id": String(userId),
      ...header
    };
    common_vendor.index.request({
      url: `${baseUrl}${url}`,
      method,
      data,
      header: headers,
      timeout: 8e3,
      success: (res) => {
        const payload = res.data || {};
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
  });
}
function request({ url, method = "GET", data = {}, header = {} }) {
  const orderedBases = [activeBaseUrl, ...BASE_URL_CANDIDATES.filter((x) => x !== activeBaseUrl)];
  const tryNext = (index, lastError) => {
    if (index >= orderedBases.length) {
      return Promise.reject(lastError || new Error("all base urls failed"));
    }
    const base = orderedBases[index];
    return requestOnce(base, { url, method, data, header }).then((payload) => {
      activeBaseUrl = base;
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
