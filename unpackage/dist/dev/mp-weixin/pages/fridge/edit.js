"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const _sfc_main = {
  components: { BottomNav, IngredientIcon },
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
      }
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
    goBackToList() {
      common_vendor.index.switchTab({
        url: "/pages/fridge/list"
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
          common_vendor.index.__f__("error", "at pages/fridge/edit.vue:206", "获取食材失败", fallbackErr);
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
        common_vendor.index.__f__("error", "at pages/fridge/edit.vue:248", "更新失败", e);
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
        common_vendor.index.__f__("error", "at pages/fridge/edit.vue:267", "删除失败", e);
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
    e: $data.form.name,
    f: common_vendor.o(($event) => $data.form.name = $event.detail.value),
    g: common_vendor.t($data.form.category || "请选择类型"),
    h: $data.categories,
    i: common_vendor.o((...args) => $options.onCategoryChange && $options.onCategoryChange(...args)),
    j: $data.form.quantity,
    k: common_vendor.o(($event) => $data.form.quantity = $event.detail.value),
    l: common_vendor.t($data.form.unit || "选择单位"),
    m: $data.units,
    n: common_vendor.o((...args) => $options.onUnitChange && $options.onUnitChange(...args)),
    o: common_vendor.f($data.locations, (loc, k0, i0) => {
      return {
        a: common_vendor.t(loc),
        b: loc,
        c: $data.form.location === loc ? 1 : "",
        d: common_vendor.o(($event) => $data.form.location = loc, loc)
      };
    }),
    p: common_vendor.t($data.form.expireDate || "选择过期时间"),
    q: $data.form.expireDate,
    r: common_vendor.o((...args) => $options.onDateChange && $options.onDateChange(...args)),
    s: common_vendor.o((...args) => $options.remove && $options.remove(...args)),
    t: common_vendor.o((...args) => $options.save && $options.save(...args)),
    v: common_vendor.p({
      current: "fridge"
    }),
    w: `${_ctx.safeTop + 14}px`
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-a679d2d3"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/fridge/edit.js.map
