"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_shelfLife = require("../../api/modules/shelf-life.js");
const utils_currentUser = require("../../utils/current-user.js");
const utils_shelfLife = require("../../utils/shelf-life.js");
const IngredientIcon = () => "../../components/ingredient-icon.js";
const _sfc_main = {
  components: { IngredientIcon },
  data() {
    return {
      userId: utils_currentUser.getCurrentUserId(),
      categories: ["水果", "蔬菜", "肉类", "蛋奶", "海鲜", "饮料", "调味品", "其他"],
      dayOptions: Array.from({ length: 365 }, (_, i) => i + 1),
      values: { ...utils_shelfLife.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
    };
  },
  async onShow() {
    this.userId = utils_currentUser.getCurrentUserId();
    await this.loadSettings();
  },
  methods: {
    async loadSettings() {
      var _a;
      try {
        const res = await api_modules_shelfLife.getShelfLifeSettings(this.userId);
        const rules = (res == null ? void 0 : res.rules) || ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.rules) || {};
        this.values = utils_shelfLife.normalizeShelfLifeDaysByCategory(rules);
      } catch (e) {
        this.values = { ...utils_shelfLife.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY };
        common_vendor.index.showToast({ title: "读取配置失败，已使用默认值", icon: "none" });
      }
    },
    goBack() {
      common_vendor.index.navigateBack();
    },
    getValueIndex(category) {
      const value = Number(this.values[category] || 1);
      const idx = this.dayOptions.findIndex((x) => Number(x) === value);
      return idx >= 0 ? idx : 0;
    },
    onRulePick(category, e) {
      var _a;
      const idx = Number((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value);
      const picked = Number(this.dayOptions[idx] || 1);
      this.values = {
        ...this.values,
        [category]: Math.min(Math.max(Math.round(picked), 1), 3650)
      };
    },
    resetDefaults() {
      this.values = { ...utils_shelfLife.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY };
      common_vendor.index.showToast({ title: "已恢复默认", icon: "none" });
    },
    async save() {
      var _a;
      try {
        const normalized = utils_shelfLife.normalizeShelfLifeDaysByCategory(this.values);
        const defaultDays = Number((normalized == null ? void 0 : normalized.其他) || 7);
        const res = await api_modules_shelfLife.updateShelfLifeSettings({
          userId: this.userId,
          defaultDays,
          rules: normalized
        });
        const rules = (res == null ? void 0 : res.rules) || ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.rules) || normalized;
        this.values = utils_shelfLife.normalizeShelfLifeDaysByCategory(rules);
        common_vendor.index.showToast({ title: "保存成功", icon: "success" });
      } catch (e) {
        common_vendor.index.showToast({ title: "保存失败，请重试", icon: "none" });
      }
    }
  }
};
if (!Array) {
  const _component_IngredientIcon = common_vendor.resolveComponent("IngredientIcon");
  _component_IngredientIcon();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o((...args) => $options.goBack && $options.goBack(...args)),
    b: common_vendor.f($data.categories, (cat, k0, i0) => {
      return {
        a: "0a40a5f2-0-" + i0,
        b: common_vendor.p({
          name: cat,
          category: cat,
          size: 34
        }),
        c: common_vendor.t(cat),
        d: common_vendor.t($data.values[cat]),
        e: $options.getValueIndex(cat),
        f: common_vendor.o(($event) => $options.onRulePick(cat, $event), cat),
        g: cat
      };
    }),
    c: $data.dayOptions,
    d: common_vendor.o((...args) => $options.resetDefaults && $options.resetDefaults(...args)),
    e: common_vendor.o((...args) => $options.save && $options.save(...args)),
    f: `${_ctx.safeTop + 14}px`
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-0a40a5f2"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/fridge/shelf-life.js.map
