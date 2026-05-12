"use strict";
const api_request = require("../request.js");
function loginWithWeChatCode(code) {
  return api_request.request({
    url: "/auth/wechat-login",
    method: "POST",
    data: {
      code: `${code || ""}`.trim()
    },
    timeout: 15e3
  });
}
exports.loginWithWeChatCode = loginWithWeChatCode;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/api/modules/auth.js.map
