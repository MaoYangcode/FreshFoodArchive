"use strict";
const common_vendor = require("../../common/vendor.js");
const store_appStore = require("../../store/app-store.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const api_modules_basket = require("../../api/modules/basket.js");
const utils_smartPurchase = require("../../utils/smart-purchase.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const _sfc_main = {
  components: { BottomNav, IngredientIcon },
  data() {
    return {
      fromFavorite: false,
      favorited: false,
      completedCount: 0,
      lastCompletedAt: "",
      recipe: {
        name: "番茄炒蛋",
        duration: 12,
        difficulty: "简单",
        servings: 2,
        ingredients: ["番茄 x2", "鸡蛋 x3", "小葱 x1", "盐 3g"],
        ingredientsText: "番茄 x2、鸡蛋 x3、小葱 x1、盐 3g",
        steps: ["西红柿切块，鸡蛋打散。", "先炒鸡蛋盛出，再炒番茄。", "回锅翻炒，调味后出锅。"]
      }
    };
  },
  computed: {
    completeButtonText() {
      return this.completedCount > 0 ? `已完成 ${this.completedCount}次` : "标记已完成";
    }
  },
  onLoad(query) {
    this.fromFavorite = !!(query && query.fromFavorite === "1");
    const cached = common_vendor.index.getStorageSync("latestRecipeDetail");
    if (cached && typeof cached === "object")
      this.applyRecipeFromRaw(cached);
    if (query && query.name)
      this.recipe.name = decodeURIComponent(query.name);
    this.syncFavoriteState(this.fromFavorite);
  },
  methods: {
    applyRecipeFromRaw(raw) {
      const ingredientText = Array.isArray(raw == null ? void 0 : raw.ingredients) ? raw.ingredients.map((x) => `${(x == null ? void 0 : x.name) || ""}${(x == null ? void 0 : x.quantity) ?? ""}${(x == null ? void 0 : x.unit) || ""}`.trim()).filter(Boolean).join("、") : "";
      const stepList = Array.isArray(raw == null ? void 0 : raw.steps) ? raw.steps.map((x) => `${x || ""}`.trim()).filter(Boolean) : [];
      this.recipe = {
        ...this.recipe,
        name: (raw == null ? void 0 : raw.name) || this.recipe.name,
        duration: Number((raw == null ? void 0 : raw.duration) || this.recipe.duration),
        difficulty: (raw == null ? void 0 : raw.difficulty) || this.recipe.difficulty,
        ingredientsText: ingredientText || this.recipe.ingredientsText,
        ingredients: ingredientText ? ingredientText.split("、") : this.recipe.ingredients,
        steps: stepList.length ? stepList : this.recipe.steps,
        raw
      };
    },
    syncFavoriteState(preferFavoriteData = false) {
      const fav = store_appStore.getFavoriteRecipeByName(this.recipe.name);
      if (!fav)
        return;
      this.favorited = true;
      this.completedCount = Number(fav.completedCount || 0);
      this.lastCompletedAt = fav.lastCompletedAt || "";
      if (!preferFavoriteData)
        return;
      if (fav.raw && typeof fav.raw === "object") {
        this.applyRecipeFromRaw(fav.raw);
        return;
      }
      const text = [...fav.available || [], ...fav.missing || []].filter(Boolean).join("、");
      this.recipe = {
        ...this.recipe,
        duration: Number(fav.duration || this.recipe.duration),
        difficulty: fav.difficulty || this.recipe.difficulty,
        ingredientsText: text || this.recipe.ingredientsText
      };
    },
    favorite() {
      if (this.favorited) {
        common_vendor.index.showToast({ title: "已在收藏中", icon: "none" });
        return;
      }
      const ok = store_appStore.addFavoriteRecipe({
        name: this.recipe.name,
        available: this.recipe.ingredients.slice(0, 2),
        missing: [],
        duration: this.recipe.duration,
        difficulty: this.recipe.difficulty,
        raw: this.recipe.raw || null
      });
      if (!ok) {
        this.favorited = true;
        common_vendor.index.showToast({ title: "已在收藏中", icon: "none" });
        return;
      }
      this.favorited = true;
      this.syncFavoriteState();
      common_vendor.index.showToast({ title: "已加入收藏", icon: "success" });
    },
    completeRecipe() {
      if (!this.favorited) {
        common_vendor.index.showToast({ title: "请先收藏菜谱", icon: "none" });
        return;
      }
      const updated = store_appStore.markFavoriteRecipeCompleted(this.recipe.name);
      if (!updated) {
        common_vendor.index.showToast({ title: "标记失败，请重试", icon: "none" });
        return;
      }
      this.completedCount = Number(updated.completedCount || 0);
      this.lastCompletedAt = updated.lastCompletedAt || "";
      common_vendor.index.showToast({ title: "已标记完成", icon: "success" });
    },
    formatDateTime(time) {
      if (!time)
        return "";
      const date = new Date(time);
      if (Number.isFinite(date.getTime())) {
        const pad = (n) => `${n}`.padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      }
      const text = `${time}`;
      if (text.includes("T"))
        return text.replace("T", " ").slice(0, 16);
      return text.slice(0, 16);
    },
    normalizeName(text) {
      return `${text || ""}`.trim().replace(/\s+/g, "").toLowerCase();
    },
    pickRecipeIngredientItems() {
      var _a, _b, _c;
      const fromRaw = Array.isArray((_b = (_a = this.recipe) == null ? void 0 : _a.raw) == null ? void 0 : _b.ingredients) ? this.recipe.raw.ingredients.map((x) => ({
        name: `${(x == null ? void 0 : x.name) || ""}`.trim(),
        quantity: Number((x == null ? void 0 : x.quantity) || 1),
        unit: `${(x == null ? void 0 : x.unit) || ""}`.trim() || "份",
        category: `${(x == null ? void 0 : x.category) || ""}`.trim()
      })).filter((x) => !!x.name) : [];
      if (fromRaw.length)
        return fromRaw;
      return `${((_c = this.recipe) == null ? void 0 : _c.ingredientsText) || ""}`.split("、").map((s) => `${s || ""}`.trim()).filter(Boolean).map((s) => ({ name: s.replace(/\d+.*$/, "").trim(), quantity: 1, unit: "份", category: "" })).filter((x) => !!x.name);
    },
    unwrapListPayload(source) {
      if (Array.isArray(source))
        return source;
      if (source && Array.isArray(source.data))
        return source.data;
      if (source && source.data && Array.isArray(source.data.data))
        return source.data.data;
      return [];
    },
    async addMissingToBasket() {
      const recipeItems = this.pickRecipeIngredientItems();
      if (!recipeItems.length) {
        common_vendor.index.showToast({ title: "暂无可加入的食材", icon: "none" });
        return;
      }
      let pantryList = [];
      try {
        const res = await api_modules_ingredients.getIngredientList();
        pantryList = this.unwrapListPayload(res);
      } catch (e) {
        pantryList = [];
      }
      if (!pantryList.length) {
        const tags = common_vendor.index.getStorageSync("latestPantryTags");
        pantryList = Array.isArray(tags) ? tags.map((name) => ({ name })) : [];
      }
      const pantrySet = new Set(pantryList.map((x) => this.normalizeName(x == null ? void 0 : x.name)).filter(Boolean));
      const missing = recipeItems.filter((x) => !pantrySet.has(this.normalizeName(x.name)));
      if (!missing.length) {
        common_vendor.index.showToast({ title: "当前食材充足，无需加入", icon: "none" });
        return;
      }
      let result = { added: 0, merged: 0 };
      const payload = missing.map((x) => utils_smartPurchase.toSmartBasketItem(x));
      try {
        result = await api_modules_basket.upsertBasketItems(payload, this.recipe.name, 1);
      } catch (e) {
        result = store_appStore.upsertBasketItems(payload, this.recipe.name);
      }
      common_vendor.index.showToast({ title: `已加入菜篮子（${result.added + result.merged}项）`, icon: "success" });
    },
    backToResult() {
      if (this.fromFavorite) {
        common_vendor.index.navigateTo({ url: "/pages/profile/favorites" });
        return;
      }
      common_vendor.index.navigateTo({ url: "/pages/recipe/result" });
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
    a: common_vendor.o((...args) => $options.backToResult && $options.backToResult(...args)),
    b: common_vendor.p({
      name: $options.pickRecipeCoverName($data.recipe),
      size: 46
    }),
    c: common_vendor.t($data.recipe.name),
    d: common_vendor.t($data.recipe.servings),
    e: common_vendor.t($data.recipe.duration),
    f: common_vendor.t($data.recipe.difficulty),
    g: common_vendor.t($data.recipe.ingredientsText),
    h: common_vendor.t($data.recipe.steps.length),
    i: common_vendor.f($data.recipe.steps, (step, idx, i0) => {
      return {
        a: common_vendor.t(idx + 1),
        b: common_vendor.t(step),
        c: idx
      };
    }),
    j: !$data.fromFavorite
  }, !$data.fromFavorite ? {
    k: common_vendor.t($data.favorited ? "已收藏" : "收藏该菜谱"),
    l: common_vendor.n($data.favorited ? "done" : "primary"),
    m: common_vendor.o((...args) => $options.favorite && $options.favorite(...args))
  } : {}, {
    n: $data.fromFavorite
  }, $data.fromFavorite ? {
    o: common_vendor.t($options.completeButtonText),
    p: common_vendor.o((...args) => $options.completeRecipe && $options.completeRecipe(...args))
  } : {}, {
    q: common_vendor.o((...args) => $options.addMissingToBasket && $options.addMissingToBasket(...args)),
    r: $data.fromFavorite && $data.lastCompletedAt
  }, $data.fromFavorite && $data.lastCompletedAt ? {
    s: common_vendor.t($options.formatDateTime($data.lastCompletedAt))
  } : {}, {
    t: common_vendor.p({
      current: "recipe"
    }),
    v: `${_ctx.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-32e4a4a3"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/recipe/detail.js.map
