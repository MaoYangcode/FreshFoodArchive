"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_profile = require("../../api/modules/profile.js");
const utils_currentUser = require("../../utils/current-user.js");
const BottomNav = () => "../../components/bottom-nav.js";
const _sfc_main = {
  components: { BottomNav },
  data() {
    return {
      userId: utils_currentUser.getCurrentUserId(),
      profileName: "微信用户",
      profileAvatar: ""
    };
  },
  onShow() {
    this.userId = utils_currentUser.getCurrentUserId();
    this.loadProfileHeader();
  },
  methods: {
    async loadProfileHeader() {
      try {
        const res = await api_modules_profile.getProfile(this.userId);
        this.profileName = `${(res == null ? void 0 : res.name) || "微信用户"}`.trim() || "微信用户";
        this.profileAvatar = `${(res == null ? void 0 : res.avatar) || ""}`.trim();
      } catch (e) {
        this.profileName = "微信用户";
        this.profileAvatar = "";
      }
    },
    goFridge() {
      common_vendor.index.navigateTo({
        url: "/pages/fridge/shelf-life"
      });
    },
    goFavorites() {
      common_vendor.index.navigateTo({ url: "/pages/profile/favorites" });
    },
    goTakeout() {
      common_vendor.index.navigateTo({ url: "/pages/profile/takeout-records" });
    },
    goBasket() {
      common_vendor.index.navigateTo({ url: "/pages/profile/basket" });
    },
    goExpiryReminder() {
      common_vendor.index.navigateTo({ url: "/pages/profile/expiry-reminder" });
    },
    goProfile() {
      common_vendor.index.navigateTo({ url: "/pages/profile/profile" });
    }
  }
};
if (!Array) {
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  _component_BottomNav();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: `${_ctx.navRightGap}px`,
    b: $data.profileAvatar
  }, $data.profileAvatar ? {
    c: $data.profileAvatar
  } : {}, {
    d: common_vendor.t($data.profileName),
    e: common_vendor.o((...args) => $options.goFridge && $options.goFridge(...args)),
    f: common_vendor.o((...args) => $options.goTakeout && $options.goTakeout(...args)),
    g: common_vendor.o((...args) => $options.goExpiryReminder && $options.goExpiryReminder(...args)),
    h: common_vendor.o((...args) => $options.goFavorites && $options.goFavorites(...args)),
    i: common_vendor.o((...args) => $options.goBasket && $options.goBasket(...args)),
    j: common_vendor.o((...args) => $options.goProfile && $options.goProfile(...args)),
    k: common_vendor.p({
      current: "profile"
    }),
    l: `${_ctx.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-201c0da5"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/profile/index.js.map
