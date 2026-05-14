"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const api_modules_recipes = require("../../api/modules/recipes.js");
const utils_currentUser = require("../../utils/current-user.js");
const BottomNav = () => "../../components/bottom-nav.js";
const RECIPE_PANTRY_CACHE_KEY = "FFA_RECIPE_PANTRY_CACHE";
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
      isGenerating: false,
      pantryIngredients: [],
      generateProgress: 0,
      progressTimer: null
    };
  },
  computed: {
    generateButtonText() {
      if (!this.isGenerating)
        return "生成菜谱";
      return `生成中 ${Math.max(1, Math.min(99, Math.round(this.generateProgress)))}%`;
    }
  },
  onLoad() {
    this.ensureShareMenu();
    this.hydratePantryCache();
  },
  onShow() {
    this.ensureShareMenu();
    this.hydratePantryCache();
    this.prefetchPantryIngredients();
  },
  onUnload() {
    this.stopProgress();
  },
  onShareAppMessage() {
    const names = (Array.isArray(this.pantryIngredients) ? this.pantryIngredients : []).map((x) => `${(x == null ? void 0 : x.name) || ""}`.trim()).filter(Boolean).slice(0, 3).join("、");
    return {
      title: names ? `我用 ${names} 一键生成了菜谱推荐` : "我在鲜食档案一键生成了菜谱推荐",
      path: "/pages/recipe/generate"
    };
  },
  onShareTimeline() {
    return {
      title: "鲜食档案 | 一键生成菜谱推荐"
    };
  },
  methods: {
    ensureShareMenu() {
      if (typeof common_vendor.index === "undefined" || typeof common_vendor.index.showShareMenu !== "function")
        return;
      try {
        common_vendor.index.showShareMenu({
          menus: ["shareAppMessage", "shareTimeline"]
        });
      } catch (_) {
      }
    },
    hydratePantryCache() {
      try {
        const cached = common_vendor.index.getStorageSync(RECIPE_PANTRY_CACHE_KEY);
        this.pantryIngredients = Array.isArray(cached) ? cached : [];
      } catch (_) {
        this.pantryIngredients = [];
      }
    },
    persistPantryCache(list) {
      try {
        common_vendor.index.setStorageSync(RECIPE_PANTRY_CACHE_KEY, Array.isArray(list) ? list : []);
      } catch (_) {
      }
    },
    normalizeIngredients(list) {
      return (Array.isArray(list) ? list : []).filter((x) => x && x.name).map((x) => ({
        name: x.name,
        quantity: Number(x.quantity || 1),
        unit: x.unit || ""
      }));
    },
    async prefetchPantryIngredients() {
      try {
        const userId = utils_currentUser.getCurrentUserId();
        const listRes = await api_modules_ingredients.getIngredientList({ userId });
        const ingredientsRaw = unwrapListPayload(listRes);
        const ingredients = this.normalizeIngredients(ingredientsRaw);
        this.pantryIngredients = ingredients;
        this.persistPantryCache(ingredients);
      } catch (_) {
      }
    },
    startProgress() {
      this.stopProgress();
      this.generateProgress = 5;
      this.progressTimer = setInterval(() => {
        if (!this.isGenerating)
          return;
        if (this.generateProgress >= 99)
          return;
        if (this.generateProgress < 60) {
          this.generateProgress += 7;
          return;
        }
        if (this.generateProgress < 85) {
          this.generateProgress += 2.8;
          return;
        }
        if (this.generateProgress < 95) {
          this.generateProgress += 1.1;
          return;
        }
        this.generateProgress += 0.35;
      }, 700);
    },
    finishProgress() {
      return new Promise((resolve) => {
        const from = Math.max(1, Number(this.generateProgress || 0));
        const to = 100;
        const totalMs = 480;
        const stepMs = 40;
        const stepCount = Math.max(1, Math.floor(totalMs / stepMs));
        let currentStep = 0;
        const timer = setInterval(() => {
          currentStep += 1;
          const ratio = Math.min(1, currentStep / stepCount);
          this.generateProgress = from + (to - from) * ratio;
          if (ratio >= 1) {
            clearInterval(timer);
            this.generateProgress = 100;
            resolve();
          }
        }, stepMs);
      });
    },
    stopProgress() {
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }
    },
    openRecipeResultPage() {
      const pages = getCurrentPages();
      const openWithRedirect = () => {
        common_vendor.index.redirectTo({
          url: "/pages/recipe/result",
          fail: () => {
            common_vendor.index.reLaunch({ url: "/pages/recipe/result" });
          }
        });
      };
      if (Array.isArray(pages) && pages.length >= 9) {
        openWithRedirect();
        return;
      }
      common_vendor.index.navigateTo({
        url: "/pages/recipe/result",
        fail: (err) => {
          const msg = `${(err == null ? void 0 : err.errMsg) || ""}`;
          if (msg.includes("webview count limit exceed")) {
            openWithRedirect();
            return;
          }
          common_vendor.index.showToast({ title: "页面跳转失败", icon: "none" });
        }
      });
    },
    async generate() {
      var _a, _b, _c;
      if (this.isGenerating)
        return;
      this.isGenerating = true;
      this.startProgress();
      try {
        const userId = utils_currentUser.getCurrentUserId();
        let ingredients = this.normalizeIngredients(this.pantryIngredients);
        if (!ingredients.length) {
          const listRes = await api_modules_ingredients.getIngredientList({ userId });
          const ingredientsRaw = unwrapListPayload(listRes);
          ingredients = this.normalizeIngredients(ingredientsRaw);
          this.pantryIngredients = ingredients;
          this.persistPantryCache(ingredients);
        }
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
        const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.generateProgress = 100;
        common_vendor.index.setStorageSync("latestGeneratedRecipes", recipes);
        common_vendor.index.setStorageSync("latestGeneratedBatchId", batchId);
        common_vendor.index.setStorageSync("latestRecipeProfileApplied", profileApplied);
        common_vendor.index.setStorageSync(
          "latestPantryTags",
          ingredients.slice(0, 6).map((x) => x.name).filter(Boolean)
        );
        common_vendor.index.setStorageSync("latestPantryIngredients", ingredients);
        await this.finishProgress();
        this.openRecipeResultPage();
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/recipe/generate.vue:245", "生成失败", e);
        const msg = `${(e == null ? void 0 : e.message) || (e == null ? void 0 : e.msg) || ((_c = e == null ? void 0 : e.data) == null ? void 0 : _c.message) || ""}`.trim();
        common_vendor.index.showToast({ title: msg || "生成失败，请稍后重试", icon: "none" });
      } finally {
        this.stopProgress();
        this.isGenerating = false;
        this.generateProgress = 0;
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
    b: common_vendor.t($options.generateButtonText),
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
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/recipe/generate.js.map
