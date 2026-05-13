"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const api_modules_recipes = require("../../api/modules/recipes.js");
const utils_currentUser = require("../../utils/current-user.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const _sfc_main = {
  components: { BottomNav, IngredientIcon },
  computed: {
    relatedButtonText() {
      if (!this.isRelatedGenerating)
        return "相关菜谱";
      return `生成中 ${Math.max(1, Math.min(99, Math.round(this.relatedProgress || 0)))}%`;
    }
  },
  data() {
    return {
      ingredientId: "",
      categories: ["水果", "蔬菜", "肉类", "蛋奶", "海鲜", "饮料", "调味品", "其他"],
      units: [
        "份",
        "盒",
        "罐",
        "包",
        "个",
        "条",
        "片",
        "根",
        "瓶",
        "袋",
        "块",
        "毫升",
        "升",
        "千克",
        "克",
        "斤",
        "公斤",
        "颗",
        "组",
        "把",
        "只",
        "杯",
        "支",
        "粒",
        "碗",
        "枚",
        "盘",
        "卷",
        "段",
        "篮",
        "捆",
        "串",
        "排",
        "桶",
        "箱",
        "颗",
        "朵",
        "管",
        "两"
      ],
      locations: ["冷藏", "冷冻"],
      form: {
        name: "",
        category: "",
        quantity: "",
        unit: "",
        location: "",
        purchaseDate: "",
        expireDate: "",
        createdAt: ""
      },
      isRelatedGenerating: false,
      relatedProgress: 0,
      relatedProgressTimer: null
    };
  },
  onLoad(options) {
    const rawId = (options == null ? void 0 : options.id) ?? (options == null ? void 0 : options.ingredientId) ?? "";
    const id = `${rawId}`.trim();
    if (id && id !== "undefined" && id !== "null") {
      this.ingredientId = id;
      this.fetchDetail();
      return;
    }
    common_vendor.index.showToast({
      title: "食材ID缺失",
      icon: "none"
    });
  },
  methods: {
    startRelatedProgress() {
      this.stopRelatedProgress();
      this.relatedProgress = 1;
      this.relatedProgressTimer = setInterval(() => {
        if (!this.isRelatedGenerating)
          return;
        if (this.relatedProgress >= 96)
          return;
        if (this.relatedProgress < 20) {
          this.relatedProgress += 1;
          return;
        }
        if (this.relatedProgress < 45) {
          this.relatedProgress += 1.6;
          return;
        }
        if (this.relatedProgress < 70) {
          this.relatedProgress += 2;
          return;
        }
        if (this.relatedProgress < 88) {
          this.relatedProgress += 1.2;
          return;
        }
        this.relatedProgress += 0.35;
      }, 700);
    },
    finishRelatedProgress() {
      return new Promise((resolve) => {
        const from = Math.max(1, Number(this.relatedProgress || 0));
        const to = 100;
        const totalMs = 1200;
        const stepMs = 60;
        const stepCount = Math.max(1, Math.floor(totalMs / stepMs));
        let currentStep = 0;
        const timer = setInterval(() => {
          currentStep += 1;
          const ratio = Math.min(1, currentStep / stepCount);
          this.relatedProgress = from + (to - from) * ratio;
          if (ratio >= 1) {
            clearInterval(timer);
            this.relatedProgress = 100;
            resolve();
          }
        }, stepMs);
      });
    },
    stopRelatedProgress() {
      if (this.relatedProgressTimer) {
        clearInterval(this.relatedProgressTimer);
        this.relatedProgressTimer = null;
      }
    },
    normalizeNameForCompare(text) {
      return `${text || ""}`.toLowerCase().replace(/[（(].*?[）)]/g, "").replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
    },
    recipeIncludesIngredient(recipe, ingredientName) {
      const key = this.normalizeNameForCompare(ingredientName);
      if (!key)
        return false;
      const haystack = [
        `${(recipe == null ? void 0 : recipe.name) || ""}`,
        ...Array.isArray(recipe == null ? void 0 : recipe.ingredients) ? recipe.ingredients.map((x) => `${(x == null ? void 0 : x.name) || ""}`) : [],
        ...Array.isArray(recipe == null ? void 0 : recipe.steps) ? recipe.steps.map((x) => `${x || ""}`) : []
      ].join(" ").toLowerCase();
      const normalized = this.normalizeNameForCompare(haystack);
      return normalized.includes(key);
    },
    openRecipeResultPage() {
      const target = "/pages/recipe/result";
      const openWithRedirect = () => {
        common_vendor.index.redirectTo({
          url: target,
          fail: () => {
            common_vendor.index.reLaunch({ url: target });
          }
        });
      };
      const pages = getCurrentPages();
      if (Array.isArray(pages) && pages.length >= 9) {
        openWithRedirect();
        return;
      }
      common_vendor.index.navigateTo({
        url: target,
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
    normalizeIngredientItem(item) {
      return {
        name: `${(item == null ? void 0 : item.name) || ""}`.trim(),
        quantity: Number((item == null ? void 0 : item.quantity) || 1),
        unit: `${(item == null ? void 0 : item.unit) || ""}`.trim(),
        category: `${(item == null ? void 0 : item.category) || ""}`.trim()
      };
    },
    async generateRelatedRecipes() {
      var _a, _b, _c;
      if (this.isRelatedGenerating)
        return;
      const focusName = `${this.form.name || ""}`.trim();
      if (!focusName) {
        common_vendor.index.showToast({ title: "当前食材名称为空", icon: "none" });
        return;
      }
      this.isRelatedGenerating = true;
      this.startRelatedProgress();
      try {
        const userId = utils_currentUser.getCurrentUserId();
        const listRes = await api_modules_ingredients.getIngredientList({ userId });
        const list = Array.isArray(listRes) ? listRes : [];
        const normalizedList = list.map((x) => this.normalizeIngredientItem(x)).filter((x) => !!x.name);
        const currentItem = this.normalizeIngredientItem(this.form);
        const pantryIngredients = normalizedList.length ? normalizedList : [currentItem];
        const hasFocus = pantryIngredients.some((x) => this.normalizeNameForCompare(x.name) === this.normalizeNameForCompare(focusName));
        const requestIngredients = hasFocus ? pantryIngredients : [currentItem, ...pantryIngredients];
        const aiRes = await api_modules_recipes.recommendRecipes({
          userId,
          ingredients: requestIngredients,
          tastePreference: "家常",
          cookingTime: 30,
          count: 6
        });
        const fullPantryRecipes = (Array.isArray((_a = aiRes == null ? void 0 : aiRes.data) == null ? void 0 : _a.recipes) ? aiRes.data.recipes : []).filter((x) => this.recipeIncludesIngredient(x, focusName));
        const profileApplied = ((_b = aiRes == null ? void 0 : aiRes.data) == null ? void 0 : _b.profileApplied) || null;
        const focusedRes = await api_modules_recipes.recommendRecipes({
          userId,
          ingredients: [currentItem],
          tastePreference: "家常",
          cookingTime: 30,
          count: 6
        });
        const singleFocusedRecipes = (Array.isArray((_c = focusedRes == null ? void 0 : focusedRes.data) == null ? void 0 : _c.recipes) ? focusedRes.data.recipes : []).filter((x) => this.recipeIncludesIngredient(x, focusName));
        const merged = [...singleFocusedRecipes, ...fullPantryRecipes];
        const seen = /* @__PURE__ */ new Set();
        const recipes = merged.filter((item) => {
          const key = this.normalizeNameForCompare(item == null ? void 0 : item.name);
          if (!key || seen.has(key))
            return false;
          seen.add(key);
          return true;
        });
        if (!recipes.length) {
          common_vendor.index.showToast({ title: "暂未生成该食材相关菜谱", icon: "none" });
          return;
        }
        await this.finishRelatedProgress();
        await new Promise((resolve) => setTimeout(resolve, 180));
        const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        common_vendor.index.setStorageSync("latestGeneratedRecipes", recipes.slice(0, 6));
        common_vendor.index.setStorageSync("latestGeneratedBatchId", batchId);
        common_vendor.index.setStorageSync("latestRecipeProfileApplied", profileApplied);
        common_vendor.index.setStorageSync("latestPantryTags", [focusName]);
        common_vendor.index.setStorageSync("latestPantryIngredients", requestIngredients);
        this.openRecipeResultPage();
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/edit.vue:315", "生成相关菜谱失败", e);
        common_vendor.index.showToast({ title: "生成失败，请稍后重试", icon: "none" });
      } finally {
        this.stopRelatedProgress();
        this.isRelatedGenerating = false;
        this.relatedProgress = 0;
      }
    },
    goBackToList() {
      if (getCurrentPages().length > 1) {
        common_vendor.index.navigateBack();
        return;
      }
      common_vendor.index.redirectTo({
        url: "/pages/fridge/list",
        fail: () => {
          common_vendor.index.reLaunch({ url: "/pages/fridge/list" });
        }
      });
    },
    pickPayload(source) {
      if (!source || typeof source !== "object")
        return source;
      if (source.data && typeof source.data === "object") {
        const nested = source.data;
        if (nested.data && typeof nested.data === "object")
          return nested.data;
        return nested;
      }
      return source;
    },
    getField(data, keys) {
      for (const key of keys) {
        if (data && data[key] !== void 0 && data[key] !== null)
          return data[key];
      }
      return "";
    },
    applyDetail(data) {
      this.form.name = this.getField(data, ["name", "ingredientName"]);
      this.form.category = this.getField(data, ["category", "type"]);
      this.form.quantity = this.getField(data, ["quantity", "qty"]);
      this.form.unit = this.getField(data, ["unit"]);
      const location = this.getField(data, ["location", "zone"]);
      this.form.location = this.locations.includes(location) ? location : "冷藏";
      const expireDate = this.getField(data, ["expireDate", "expire_date"]);
      const purchaseDate = this.getField(data, ["purchaseDate", "purchase_date", "createdAt", "created_at"]);
      const createdAt = this.getField(data, ["createdAt", "created_at", "purchaseDate", "purchase_date"]);
      this.form.expireDate = expireDate ? `${expireDate}`.slice(0, 10) : "";
      this.form.purchaseDate = purchaseDate ? `${purchaseDate}`.slice(0, 10) : "";
      this.form.createdAt = createdAt ? `${createdAt}`.slice(0, 10) : "";
    },
    onCategoryChange(e) {
      this.form.category = this.categories[e.detail.value];
    },
    onUnitChange(e) {
      this.form.unit = this.units[e.detail.value];
    },
    onLocationChange(e) {
      this.form.location = this.locations[e.detail.value];
    },
    onDateChange(e) {
      var _a;
      const value = ((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value) || "";
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (value && value < today) {
        common_vendor.index.showToast({ title: "过期日期不能早于今天", icon: "none" });
        this.form.expireDate = "";
        return;
      }
      this.form.expireDate = value;
    },
    onPurchaseDateChange(e) {
      this.form.purchaseDate = e.detail.value;
    },
    async fetchDetail() {
      try {
        const res = await api_modules_ingredients.getIngredientDetail(this.ingredientId);
        const data = this.pickPayload(res);
        this.applyDetail(data);
      } catch (e) {
        try {
          const listRes = await api_modules_ingredients.getIngredientList();
          const list = Array.isArray(listRes) ? listRes : [];
          const current = list.find((x) => `${x.id}` === `${this.ingredientId}`);
          if (!current) {
            common_vendor.index.showToast({
              title: "未找到食材数据",
              icon: "none"
            });
            return;
          }
          this.applyDetail(current);
        } catch (fallbackErr) {
          common_vendor.index.__f__("error", "at pages/fridge/edit.vue:406", "获取食材失败", fallbackErr);
          common_vendor.index.showToast({
            title: "获取食材失败",
            icon: "none"
          });
        }
      }
    },
    async save() {
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (!this.form.name || !this.form.category || !this.form.quantity || !this.form.unit || !this.form.location || !this.form.expireDate) {
        common_vendor.index.showToast({ title: "请先填写完整信息", icon: "none" });
        return;
      }
      if (this.form.expireDate < today) {
        common_vendor.index.showToast({ title: "过期日期不能早于今天", icon: "none" });
        return;
      }
      if (!this.ingredientId) {
        common_vendor.index.showToast({ title: "食材ID缺失", icon: "none" });
        return;
      }
      try {
        await api_modules_ingredients.updateIngredient(this.ingredientId, {
          name: this.form.name,
          category: this.form.category,
          quantity: Number(this.form.quantity),
          unit: this.form.unit,
          location: this.form.location,
          expireDate: this.form.expireDate
        });
        common_vendor.index.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => {
          common_vendor.index.navigateBack();
        }, 300);
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/edit.vue:448", "更新失败", e);
        common_vendor.index.showToast({ title: "保存失败", icon: "none" });
      }
    },
    async remove() {
      if (!this.ingredientId) {
        common_vendor.index.showToast({ title: "食材ID缺失", icon: "none" });
        return;
      }
      try {
        await api_modules_ingredients.deleteIngredient(this.ingredientId);
        common_vendor.index.showToast({ title: "已删除", icon: "success" });
        setTimeout(() => {
          common_vendor.index.navigateBack();
        }, 300);
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/edit.vue:467", "删除失败", e);
        common_vendor.index.showToast({ title: "删除失败", icon: "none" });
      }
    }
  }
};
if (!Array) {
  const _component_IngredientIcon = common_vendor.resolveComponent("IngredientIcon");
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  (_component_IngredientIcon + _component_BottomNav)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o((...args) => $options.goBackToList && $options.goBackToList(...args)),
    b: common_vendor.p({
      name: $data.form.name,
      category: $data.form.category,
      size: 54
    }),
    c: common_vendor.t($data.form.name || "食材"),
    d: common_vendor.t($data.form.createdAt || "-"),
    e: common_vendor.t($options.relatedButtonText),
    f: $data.isRelatedGenerating || !$data.form.name,
    g: common_vendor.o((...args) => $options.generateRelatedRecipes && $options.generateRelatedRecipes(...args)),
    h: $data.form.name,
    i: common_vendor.o(($event) => $data.form.name = $event.detail.value),
    j: common_vendor.t($data.form.category || "请选择类型"),
    k: $data.categories,
    l: common_vendor.o((...args) => $options.onCategoryChange && $options.onCategoryChange(...args)),
    m: $data.form.quantity,
    n: common_vendor.o(($event) => $data.form.quantity = $event.detail.value),
    o: common_vendor.t($data.form.unit || "选择单位"),
    p: $data.units,
    q: common_vendor.o((...args) => $options.onUnitChange && $options.onUnitChange(...args)),
    r: common_vendor.f($data.locations, (loc, k0, i0) => {
      return {
        a: common_vendor.t(loc),
        b: loc,
        c: $data.form.location === loc ? 1 : "",
        d: common_vendor.o(($event) => $data.form.location = loc, loc)
      };
    }),
    s: common_vendor.t($data.form.expireDate || "选择过期时间"),
    t: $data.form.expireDate,
    v: common_vendor.o((...args) => $options.onDateChange && $options.onDateChange(...args)),
    w: common_vendor.o((...args) => $options.remove && $options.remove(...args)),
    x: common_vendor.o((...args) => $options.save && $options.save(...args)),
    y: common_vendor.p({
      current: "fridge"
    }),
    z: `${_ctx.safeTop + 14}px`
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-a679d2d3"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/fridge/edit.js.map
