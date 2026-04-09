"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const api_modules_recipes = require("../../api/modules/recipes.js");
const utils_currentUser = require("../../utils/current-user.js");
const BottomNav = () => "../../components/bottom-nav.js";
function unwrapListPayload(source) {
  if (Array.isArray(source))
    return source;
  if (source && Array.isArray(source.data))
    return source.data;
  if (source && source.data && Array.isArray(source.data.data))
    return source.data.data;
  return [];
}
const _sfc_main = {
  components: { BottomNav },
  data() {
    return {
      isGenerating: false
    };
  },
  methods: {
    async generate() {
      var _a, _b;
      if (this.isGenerating)
        return;
      this.isGenerating = true;
      try {
        const userId = utils_currentUser.getCurrentUserId();
        const listRes = await api_modules_ingredients.getIngredientList({ userId });
        const ingredientsRaw = unwrapListPayload(listRes);
        const ingredients = ingredientsRaw.filter((x) => x && x.name).map((x) => ({
          name: x.name,
          quantity: Number(x.quantity || 1),
          unit: x.unit || ""
        }));
        if (!ingredients.length) {
          common_vendor.index.showToast({ title: "暂无可用食材", icon: "none" });
          return;
        }
        const aiRes = await api_modules_recipes.recommendRecipes({
          userId,
          ingredients,
          tastePreference: "家常",
          cookingTime: 30,
          count: 6
        });
        const recipes = Array.isArray((_a = aiRes == null ? void 0 : aiRes.data) == null ? void 0 : _a.recipes) ? aiRes.data.recipes : [];
        const profileApplied = ((_b = aiRes == null ? void 0 : aiRes.data) == null ? void 0 : _b.profileApplied) || null;
        if (!recipes.length) {
          common_vendor.index.showToast({ title: "未生成菜谱，请重试", icon: "none" });
          return;
        }
        common_vendor.index.setStorageSync("latestGeneratedRecipes", recipes);
        common_vendor.index.setStorageSync("latestRecipeProfileApplied", profileApplied);
        common_vendor.index.setStorageSync(
          "latestPantryTags",
          ingredients.slice(0, 6).map((x) => x.name).filter(Boolean)
        );
        common_vendor.index.navigateTo({ url: "/pages/recipe/result" });
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/recipe/generate.vue:88", "生成失败", e);
        common_vendor.index.showToast({ title: "生成失败，请稍后重试", icon: "none" });
      } finally {
        this.isGenerating = false;
      }
    }
  }
};
if (!Array) {
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  _component_BottomNav();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: `${_ctx.navRightGap}px`,
    b: common_vendor.t($data.isGenerating ? "生成中..." : "生成菜谱"),
    c: $data.isGenerating,
    d: $data.isGenerating,
    e: common_vendor.o((...args) => $options.generate && $options.generate(...args)),
    f: common_vendor.p({
      current: "recipe"
    }),
    g: `${_ctx.safeTop + 14}px`
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-3fc7d593"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/recipe/generate.js.map
