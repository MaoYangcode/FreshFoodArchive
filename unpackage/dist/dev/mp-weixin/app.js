"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const utils_currentUser = require("./utils/current-user.js");
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
const _sfc_main = {
  onLaunch: function() {
    utils_currentUser.setCurrentUserId(1);
    common_vendor.index.__f__("log", "at App.vue:8", "FreshFoodArchive Launch");
  },
  onShow: function() {
    common_vendor.index.__f__("log", "at App.vue:11", "FreshFoodArchive Show");
  },
  onHide: function() {
    common_vendor.index.__f__("log", "at App.vue:14", "FreshFoodArchive Hide");
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
