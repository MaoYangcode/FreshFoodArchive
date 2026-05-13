"use strict";
const common_vendor = require("../../common/vendor.js");
const store_appStore = require("../../store/app-store.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const _sfc_main = {
  components: { BottomNav, IngredientIcon },
  data() {
    return {
      recipes: [],
      startDate: "",
      endDate: "",
      quickRange: "all",
      keyword: "",
      openSwipeId: "",
      touchStartX: 0,
      touchStartY: 0,
      touchDeltaX: 0,
      touchDeltaY: 0,
      touchHorizontalLock: null
    };
  },
  computed: {
    filteredRecipes() {
      const start = this.startDate;
      const end = this.endDate;
      const key = `${this.keyword || ""}`.trim().toLowerCase();
      return this.recipes.filter((item) => {
        var _a;
        const day = this.extractDay(item.favoritedAt || item.createdAt);
        if (start && day && day < start)
          return false;
        if (end && day && day > end)
          return false;
        if (key) {
          const ingredientText = Array.isArray((_a = item == null ? void 0 : item.raw) == null ? void 0 : _a.ingredients) ? item.raw.ingredients.map((x) => `${(x == null ? void 0 : x.name) || ""}`).join(" ") : `${Array.isArray(item == null ? void 0 : item.available) ? item.available.join(" ") : ""} ${Array.isArray(item == null ? void 0 : item.missing) ? item.missing.join(" ") : ""}`;
          const haystack = `${(item == null ? void 0 : item.name) || ""} ${ingredientText}`.toLowerCase();
          if (!haystack.includes(key))
            return false;
        }
        return true;
      });
    }
  },
  onShow() {
    this.recipes = store_appStore.getFavoriteRecipes();
  },
  methods: {
    goBack() {
      if (getCurrentPages().length > 1) {
        common_vendor.index.navigateBack();
        return;
      }
      common_vendor.index.redirectTo({
        url: "/pages/profile/index",
        fail: () => {
          common_vendor.index.navigateTo({
            url: "/pages/profile/index",
            fail: () => {
              common_vendor.index.reLaunch({ url: "/pages/profile/index" });
            }
          });
        }
      });
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
      common_vendor.index.navigateTo({
        url: `/pages/recipe/detail?name=${encodeURIComponent(item.name)}&fromFavorite=1`
      });
    },
    formatDateTime(time) {
      if (!time)
        return "";
      const date = new Date(time);
      if (Number.isFinite(date.getTime())) {
        const pad = (n) => `${n}`.padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      }
      const text = `${time}`;
      if (text.includes("T"))
        return text.slice(0, 10);
      return text.slice(0, 10);
    },
    extractDay(time) {
      return this.formatDateTime(time);
    },
    onStartDateChange(e) {
      this.startDate = e.detail.value;
      this.quickRange = "custom";
      if (this.endDate && this.startDate > this.endDate) {
        this.endDate = this.startDate;
      }
    },
    onEndDateChange(e) {
      this.endDate = e.detail.value;
      this.quickRange = "custom";
      if (this.startDate && this.endDate < this.startDate) {
        this.startDate = this.endDate;
      }
    },
    applyQuickRange(type) {
      this.quickRange = type;
      if (type === "all") {
        this.startDate = "";
        this.endDate = "";
        return;
      }
      const today = /* @__PURE__ */ new Date();
      const pad = (n) => `${n}`.padStart(2, "0");
      const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const end = new Date(today);
      const start = new Date(today);
      start.setDate(today.getDate() - (type === "7d" ? 6 : 29));
      this.startDate = format(start);
      this.endDate = format(end);
    },
    onKeywordInput(e) {
      this.keyword = e && e.detail ? `${e.detail.value || ""}` : "";
    },
    onTouchStart(e, id) {
      var _a;
      if (!((_a = e == null ? void 0 : e.touches) == null ? void 0 : _a.length))
        return;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchDeltaX = 0;
      this.touchDeltaY = 0;
      this.touchHorizontalLock = null;
      if (this.openSwipeId && this.openSwipeId !== id) {
        this.openSwipeId = "";
      }
    },
    onTouchMove(e) {
      var _a;
      if (!((_a = e == null ? void 0 : e.touches) == null ? void 0 : _a.length))
        return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      this.touchDeltaX = x - this.touchStartX;
      this.touchDeltaY = y - this.touchStartY;
      if (this.touchHorizontalLock === null) {
        const absX = Math.abs(this.touchDeltaX);
        const absY = Math.abs(this.touchDeltaY);
        if (absX > 8 || absY > 8) {
          this.touchHorizontalLock = absX > absY + 6;
        }
      }
    },
    onTouchEnd(e, id) {
      var _a;
      if (!((_a = e == null ? void 0 : e.changedTouches) == null ? void 0 : _a.length))
        return;
      const endX = e.changedTouches[0].clientX;
      const deltaX = this.touchDeltaX || endX - this.touchStartX;
      const horizontalSwipe = this.touchHorizontalLock === true;
      if (horizontalSwipe && deltaX < -35) {
        this.openSwipeId = id;
        this.touchHorizontalLock = null;
        return;
      }
      if (horizontalSwipe && deltaX > 35) {
        this.openSwipeId = "";
      }
      this.touchHorizontalLock = null;
    },
    closeSwipe() {
      this.openSwipeId = "";
    },
    onCardTap(item) {
      if (this.openSwipeId === item.id) {
        this.openSwipeId = "";
        return;
      }
      this.openDetail(item);
    },
    onRemoveFavorite(item) {
      const name = `${(item == null ? void 0 : item.name) || ""}`.trim();
      if (!name)
        return;
      const ok = store_appStore.removeFavoriteRecipe(name);
      this.openSwipeId = "";
      if (!ok) {
        common_vendor.index.showToast({ title: "取消失败", icon: "none" });
        return;
      }
      this.recipes = store_appStore.getFavoriteRecipes();
      common_vendor.index.showToast({ title: "已取消收藏", icon: "success" });
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
    a: common_vendor.o((...args) => $options.goBack && $options.goBack(...args)),
    b: $data.recipes.length > 0
  }, $data.recipes.length > 0 ? {
    c: common_vendor.t($data.startDate || "开始日期"),
    d: $data.startDate,
    e: common_vendor.o((...args) => $options.onStartDateChange && $options.onStartDateChange(...args)),
    f: common_vendor.t($data.endDate || "结束日期"),
    g: $data.endDate,
    h: common_vendor.o((...args) => $options.onEndDateChange && $options.onEndDateChange(...args)),
    i: $data.quickRange === "all" ? 1 : "",
    j: common_vendor.o(($event) => $options.applyQuickRange("all")),
    k: $data.quickRange === "7d" ? 1 : "",
    l: common_vendor.o(($event) => $options.applyQuickRange("7d")),
    m: $data.quickRange === "30d" ? 1 : "",
    n: common_vendor.o(($event) => $options.applyQuickRange("30d"))
  } : {}, {
    o: $data.recipes.length > 0
  }, $data.recipes.length > 0 ? {
    p: $data.keyword,
    q: common_vendor.o((...args) => $options.onKeywordInput && $options.onKeywordInput(...args))
  } : {}, {
    r: $options.filteredRecipes.length === 0
  }, $options.filteredRecipes.length === 0 ? {
    s: common_vendor.t($data.recipes.length === 0 ? "暂无收藏，去菜谱详情点击“收藏该菜谱”。" : "当前筛选条件下暂无收藏菜谱。")
  } : {}, {
    t: common_vendor.f($options.filteredRecipes, (item, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.o(($event) => $options.onRemoveFavorite(item), item.id),
        b: "27b641db-0-" + i0,
        c: common_vendor.p({
          name: $options.pickRecipeCoverName(item),
          size: 44
        }),
        d: common_vendor.t(item.name),
        e: common_vendor.t(item.duration),
        f: common_vendor.t(item.difficulty),
        g: common_vendor.t(Number(item.completedCount || 0) > 0 ? `已完成 ${item.completedCount}次` : "未完成"),
        h: common_vendor.n(Number(item.completedCount || 0) > 0 ? "done" : "todo"),
        i: item.lastCompletedAt
      }, item.lastCompletedAt ? {
        j: common_vendor.t($options.formatDateTime(item.lastCompletedAt))
      } : {}, {
        k: $data.openSwipeId === item.id ? 1 : "",
        l: common_vendor.o(($event) => $options.onTouchStart($event, item.id), item.id),
        m: common_vendor.o(($event) => $options.onTouchMove($event), item.id),
        n: common_vendor.o(($event) => $options.onTouchEnd($event, item.id), item.id),
        o: common_vendor.o(($event) => $options.onCardTap(item), item.id),
        p: item.id
      });
    }),
    v: common_vendor.p({
      current: "profile"
    }),
    w: `${_ctx.safeTop + 14}px`,
    x: common_vendor.o((...args) => $options.closeSwipe && $options.closeSwipe(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-27b641db"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/profile/favorites.js.map
