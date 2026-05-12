"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const utils_currentUser = require("./utils/current-user.js");
const api_modules_auth = require("./api/modules/auth.js");
if (!Math) {
  "./pages/home/index.js";
  "./pages/fridge/list.js";
  "./pages/fridge/add.js";
  "./pages/fridge/edit.js";
  "./pages/fridge/shelf-life.js";
  "./pages/recipe/generate.js";
  "./pages/recipe/result.js";
  "./pages/recipe/detail.js";
  "./pages/profile/index.js";
  "./pages/profile/takeout-records.js";
  "./pages/profile/favorites.js";
  "./pages/profile/basket.js";
  "./pages/profile/expiry-reminder.js";
  "./pages/profile/profile.js";
}
function toUserId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    return 0;
  return Math.floor(n);
}
function getLoginErrorMessage(err) {
  var _a, _b;
  const message = `${(err == null ? void 0 : err.message) || ""}`.trim() || `${(err == null ? void 0 : err.msg) || ""}`.trim() || `${(err == null ? void 0 : err.error) || ""}`.trim() || `${((_a = err == null ? void 0 : err.data) == null ? void 0 : _a.message) || ""}`.trim();
  if (message)
    return `微信登录失败：${message}`;
  const statusCode = Number((err == null ? void 0 : err.statusCode) || ((_b = err == null ? void 0 : err.data) == null ? void 0 : _b.statusCode) || 0);
  if (statusCode)
    return `微信登录失败：服务返回 ${statusCode}`;
  return "微信登录失败，请检查网络后重试";
}
const _sfc_main = {
  onLaunch: function() {
    this.bootstrapUserId();
    common_vendor.index.__f__("log", "at App.vue:26", "FreshFoodArchive Launch");
  },
  methods: {
    bootstrapUserId() {
      if (typeof common_vendor.index === "undefined" || typeof common_vendor.index.login !== "function") {
        this.retryForceLogin("当前环境不支持微信登录，请在微信内打开小程序");
        return;
      }
      common_vendor.index.login({
        provider: "weixin",
        success: ({ code }) => {
          const safeCode = `${code || ""}`.trim();
          if (!safeCode) {
            this.retryForceLogin("未获取到微信登录凭证，请重试");
            return;
          }
          api_modules_auth.loginWithWeChatCode(safeCode).then((res) => {
            const userId = toUserId(res == null ? void 0 : res.userId);
            const token = `${(res == null ? void 0 : res.token) || ""}`.trim();
            if (!userId || !token) {
              throw new Error("invalid login payload");
            }
            utils_currentUser.setCurrentUserId(userId);
            utils_currentUser.setAuthToken(token);
          }).catch((err) => {
            this.retryForceLogin(getLoginErrorMessage(err));
          });
        },
        fail: () => {
          this.retryForceLogin("微信登录失败，请检查网络后重试");
        }
      });
    },
    retryForceLogin(message) {
      utils_currentUser.clearCurrentUserId();
      utils_currentUser.clearAuthToken();
      common_vendor.index.showModal({
        title: "需要微信登录",
        content: message || "登录失败，请重试",
        showCancel: false,
        confirmText: "重试",
        success: () => {
          setTimeout(() => this.bootstrapUserId(), 250);
        }
      });
    }
  },
  onShow: function() {
    common_vendor.index.__f__("log", "at App.vue:76", "FreshFoodArchive Show");
  },
  onHide: function() {
    common_vendor.index.__f__("log", "at App.vue:79", "FreshFoodArchive Hide");
  }
};
function createApp() {
  const readInitialSafeTop = () => {
    try {
      const info = common_vendor.index.getSystemInfoSync();
      const top = Number((info == null ? void 0 : info.statusBarHeight) || 0);
      if (Number.isFinite(top) && top > 0)
        return top;
    } catch (e) {
    }
    return 20;
  };
  const readInitialNavRightGap = () => {
    try {
      const info = common_vendor.index.getSystemInfoSync();
      if (typeof common_vendor.index.getMenuButtonBoundingClientRect === "function") {
        const menu = common_vendor.index.getMenuButtonBoundingClientRect();
        const windowWidth = Number((info == null ? void 0 : info.windowWidth) || 0);
        const rightGap = windowWidth > 0 && menu ? Math.round(windowWidth - Number(menu.left || 0) + 8) : 12;
        if (Number.isFinite(rightGap) && rightGap > 0)
          return rightGap;
      }
    } catch (e) {
    }
    return 12;
  };
  const app = common_vendor.createSSRApp(_sfc_main);
  app.mixin({
    data() {
      return {
        safeTop: readInitialSafeTop(),
        navRightGap: readInitialNavRightGap()
      };
    },
    onLoad() {
      try {
        const info = common_vendor.index.getSystemInfoSync();
        const top = Number((info == null ? void 0 : info.statusBarHeight) || 0);
        if (Number.isFinite(top) && top > 0)
          this.safeTop = top;
        if (typeof common_vendor.index.getMenuButtonBoundingClientRect === "function") {
          const menu = common_vendor.index.getMenuButtonBoundingClientRect();
          const windowWidth = Number((info == null ? void 0 : info.windowWidth) || 0);
          const rightGap = windowWidth > 0 && menu ? Math.round(windowWidth - Number(menu.left || 0) + 8) : 12;
          if (Number.isFinite(rightGap) && rightGap > 0)
            this.navRightGap = rightGap;
        }
      } catch (e) {
      }
    }
  });
  return {
    app
  };
}
createApp().app.mount("#app");
exports.createApp = createApp;
//# sourceMappingURL=../.sourcemap/mp-weixin/app.js.map
