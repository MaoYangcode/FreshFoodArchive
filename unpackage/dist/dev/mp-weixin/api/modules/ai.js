"use strict";
const common_vendor = require("../../common/vendor.js");
const api_request = require("../request.js");
const utils_currentUser = require("../../utils/current-user.js");
function recognizeIngredientsByUpload(filePath) {
  return uploadAiFile("/ai/recognize-ingredient", filePath);
}
function recognizeReceiptByUpload(filePath) {
  return uploadAiFile("/ai/recognize-receipt", filePath);
}
function recognizeAudioByUpload(filePath) {
  return uploadAiFile("/ai/recognize-audio", filePath);
}
function uploadAiFile(apiPath, filePath) {
  return new Promise((resolve, reject) => {
    const token = `${utils_currentUser.getAuthToken() || ""}`.trim();
    if (!token) {
      reject({
        code: 401,
        message: "请先完成微信登录"
      });
      return;
    }
    common_vendor.index.uploadFile({
      url: `${api_request.getActiveBaseUrl()}${apiPath}`,
      filePath,
      name: "file",
      header: {
        Authorization: `Bearer ${token}`
      },
      success: (res) => {
        try {
          const statusCode = Number((res == null ? void 0 : res.statusCode) || 0);
          const payload = JSON.parse((res == null ? void 0 : res.data) || "{}");
          if (statusCode < 200 || statusCode >= 300) {
            reject(payload);
            return;
          }
          if (payload.code === 0 || payload.code === void 0) {
            resolve(payload);
            return;
          }
          reject(payload);
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => reject(err)
    });
  });
}
exports.recognizeAudioByUpload = recognizeAudioByUpload;
exports.recognizeIngredientsByUpload = recognizeIngredientsByUpload;
exports.recognizeReceiptByUpload = recognizeReceiptByUpload;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/ai.js.map
