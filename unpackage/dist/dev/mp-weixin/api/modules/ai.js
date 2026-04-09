"use strict";
const common_vendor = require("../../common/vendor.js");
const api_request = require("../request.js");
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
    common_vendor.index.uploadFile({
      url: `${api_request.getActiveBaseUrl()}${apiPath}`,
      filePath,
      name: "file",
      success: (res) => {
        try {
          const payload = JSON.parse((res == null ? void 0 : res.data) || "{}");
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
