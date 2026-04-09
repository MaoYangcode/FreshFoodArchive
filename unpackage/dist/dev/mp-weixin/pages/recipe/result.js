"use strict";
const common_vendor = require("../../common/vendor.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const _sfc_main = {
  components: { BottomNav, IngredientIcon },
  data() {
    return {
      pantryTags: ["番茄", "鸡蛋", "牛肉", "洋葱"],
      sortMode: "score",
      sortOptions: [
        { key: "score", label: "按匹配度" },
        { key: "duration", label: "按用时" },
        { key: "difficulty", label: "按难度" }
      ],
      cookingTimeOptions: [0, 20, 30, 45, 60],
      selectedCookingTime: 30,
      recipes: [
        {
          id: 1,
          name: "番茄炒蛋",
          score: 96,
          duration: 10,
          difficulty: "简单",
          emoji: "🍅",
          sourceIndex: 0,
          raw: { ingredients: [{ name: "番茄" }, { name: "鸡蛋" }] }
        },
        {
          id: 2,
          name: "黑椒牛肉",
          score: 89,
          duration: 18,
          difficulty: "中等",
          emoji: "🥩",
          sourceIndex: 1,
          raw: { ingredients: [{ name: "牛肉" }, { name: "洋葱" }] }
        }
      ],
      profileApplied: null
    };
  },
  computed: {
    cookingTimeLabels() {
      return this.cookingTimeOptions.map((v) => v <= 0 ? "不限时长" : `${v}分钟内`);
    },
    currentCookingTimeLabel() {
      const v = Number(this.selectedCookingTime || 0);
      return v <= 0 ? "不限时长" : `${v}分钟内`;
    },
    displayRecipes() {
      const pantrySet = new Set(this.pantryTags.map((x) => this.normalizeName(x)).filter(Boolean));
      const withHint = this.recipes.map((item) => {
        var _a;
        const required = Array.isArray((_a = item == null ? void 0 : item.raw) == null ? void 0 : _a.ingredients) ? item.raw.ingredients.map((x) => this.normalizeName(x == null ? void 0 : x.name)).filter(Boolean) : [];
        const missing = required.filter((name) => !pantrySet.has(name));
        const missingCount = missing.length;
        const missingText = required.length === 0 ? "食材信息待补充" : missingCount === 0 ? "可直接做" : `缺少 ${missingCount} 项食材`;
        return { ...item, missingCount, missingText };
      });
      const filtered = withHint.filter((item) => {
        const limit = Number(this.selectedCookingTime || 0);
        if (limit > 0 && Number(item.duration || 0) > limit)
          return false;
        return true;
      });
      return filtered.sort((a, b) => this.compareRecipes(a, b));
    }
  },
  onShow() {
    this.loadGeneratedRecipes();
  },
  methods: {
    onCookingTimeChange(e) {
      var _a;
      const idx = Number((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value);
      if (!Number.isFinite(idx) || idx < 0 || idx >= this.cookingTimeOptions.length)
        return;
      this.selectedCookingTime = this.cookingTimeOptions[idx];
    },
    getSortIcon(key) {
      if (key === "score")
        return "◎";
      if (key === "duration")
        return "";
      if (key === "difficulty")
        return "";
      return "";
    },
    loadGeneratedRecipes() {
      const pantry = common_vendor.index.getStorageSync("latestPantryTags");
      if (Array.isArray(pantry) && pantry.length) {
        this.pantryTags = pantry;
      }
      const generated = common_vendor.index.getStorageSync("latestGeneratedRecipes");
      const profileApplied = common_vendor.index.getStorageSync("latestRecipeProfileApplied");
      this.profileApplied = profileApplied && typeof profileApplied === "object" ? profileApplied : null;
      if (!Array.isArray(generated) || !generated.length)
        return;
      this.recipes = generated.map((item, idx) => ({
        id: item.id || idx + 1,
        name: item.name || `菜谱 ${idx + 1}`,
        score: Number(item.matchScore || item.score || 85),
        duration: Number(item.duration || 15),
        difficulty: item.difficulty || "简单",
        emoji: this.pickEmoji(item),
        sourceIndex: idx,
        raw: item
      }));
    },
    normalizeName(text) {
      return `${text || ""}`.trim().replace(/\s+/g, "").toLowerCase();
    },
    getDifficultyWeight(v) {
      if (v === "简单")
        return 1;
      if (v === "中等")
        return 2;
      if (v === "困难")
        return 3;
      return 9;
    },
    compareRecipes(a, b) {
      if (this.sortMode === "duration") {
        if (a.duration !== b.duration)
          return a.duration - b.duration;
        if (a.score !== b.score)
          return b.score - a.score;
        return (a.sourceIndex || 0) - (b.sourceIndex || 0);
      }
      if (this.sortMode === "difficulty") {
        const diff = this.getDifficultyWeight(a.difficulty) - this.getDifficultyWeight(b.difficulty);
        if (diff !== 0)
          return diff;
        if (a.score !== b.score)
          return b.score - a.score;
        return (a.sourceIndex || 0) - (b.sourceIndex || 0);
      }
      if (a.score !== b.score)
        return b.score - a.score;
      if (a.duration !== b.duration)
        return a.duration - b.duration;
      return (a.sourceIndex || 0) - (b.sourceIndex || 0);
    },
    pickEmoji(item) {
      const text = `${(item == null ? void 0 : item.name) || ""} ${Array.isArray(item == null ? void 0 : item.ingredients) ? item.ingredients.map((x) => (x == null ? void 0 : x.name) || "").join(" ") : ""}`;
      if (text.includes("牛") || text.includes("肉"))
        return "🥩";
      if (text.includes("鸡") || text.includes("蛋"))
        return "🍳";
      if (text.includes("鱼"))
        return "🐟";
      if (text.includes("虾"))
        return "🍤";
      return "🍽️";
    },
    pickRecipeCoverName(item) {
      var _a, _b;
      const first = Array.isArray((_a = item == null ? void 0 : item.raw) == null ? void 0 : _a.ingredients) ? (_b = item.raw.ingredients.find((x) => x == null ? void 0 : x.name)) == null ? void 0 : _b.name : "";
      if (first)
        return first;
      const text = `${(item == null ? void 0 : item.name) || ""}`;
      if (text.includes("牛"))
        return "牛肉";
      if (text.includes("鸡蛋"))
        return "鸡蛋";
      if (text.includes("鸡"))
        return "鸡肉";
      if (text.includes("土豆"))
        return "土豆";
      if (text.includes("黄瓜"))
        return "黄瓜";
      if (text.includes("番茄") || text.includes("西红柿"))
        return "番茄";
      return "";
    },
    openDetail(item) {
      if (item && item.raw) {
        common_vendor.index.setStorageSync("latestRecipeDetail", item.raw);
      }
      common_vendor.index.navigateTo({ url: `/pages/recipe/detail?name=${encodeURIComponent(item.name)}` });
    }
  }
};
if (!Array) {
  const _component_IngredientIcon = common_vendor.resolveComponent("IngredientIcon");
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  (_component_IngredientIcon + _component_BottomNav)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: `${_ctx.navRightGap}px`,
    b: common_vendor.f($data.pantryTags, (x, idx, i0) => {
      return {
        a: common_vendor.t(x),
        b: idx
      };
    }),
    c: common_vendor.f($data.sortOptions, (opt, k0, i0) => {
      return {
        a: common_vendor.t($options.getSortIcon(opt.key)),
        b: opt.key === "duration" || opt.key === "difficulty" ? 1 : "",
        c: opt.key === "duration" ? 1 : "",
        d: common_vendor.t(opt.label),
        e: opt.key,
        f: $data.sortMode === opt.key ? 1 : "",
        g: common_vendor.o(($event) => $data.sortMode = opt.key, opt.key)
      };
    }),
    d: common_vendor.t($options.currentCookingTimeLabel),
    e: $options.cookingTimeLabels,
    f: common_vendor.o((...args) => $options.onCookingTimeChange && $options.onCookingTimeChange(...args)),
    g: common_vendor.f($options.displayRecipes, (item, k0, i0) => {
      return {
        a: "39dbef3f-0-" + i0,
        b: common_vendor.p({
          name: $options.pickRecipeCoverName(item),
          size: 44
        }),
        c: common_vendor.t(item.name),
        d: common_vendor.t(item.score),
        e: common_vendor.t(item.duration),
        f: common_vendor.t(item.difficulty),
        g: item.id,
        h: common_vendor.o(($event) => $options.openDetail(item), item.id)
      };
    }),
    h: _ctx.idx === 0 ? 1 : "",
    i: !$options.displayRecipes.length
  }, !$options.displayRecipes.length ? {} : {}, {
    j: common_vendor.p({
      current: "recipe"
    }),
    k: `${_ctx.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-39dbef3f"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/recipe/result.js.map
