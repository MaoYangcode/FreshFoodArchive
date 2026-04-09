"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const LocationIcon = () => "../../components/location-icon.js";
const _sfc_main = {
  components: { BottomNav, IngredientIcon, LocationIcon },
  data() {
    return {
      records: [],
      startDate: "",
      endDate: "",
      quickRange: "all"
    };
  },
  computed: {
    filteredRecords() {
      const start = this.startDate;
      const end = this.endDate;
      return this.records.filter((record) => {
        const day = this.extractDay(record.time);
        if (!day)
          return false;
        if (start && day < start)
          return false;
        if (end && day > end)
          return false;
        return true;
      });
    }
  },
  async onShow() {
    var _a;
    try {
      const res = await api_modules_ingredients.getTakeoutRecords();
      this.records = Array.isArray(res) ? res : Array.isArray(res == null ? void 0 : res.data) ? res.data : Array.isArray((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.data) ? res.data.data : [];
    } catch (e) {
      this.records = [];
      common_vendor.index.showToast({ title: "加载记录失败", icon: "none" });
    }
  },
  methods: {
    goBack() {
      common_vendor.index.navigateBack();
    },
    formatDateTime(time) {
      if (!time)
        return "--";
      const date = new Date(time);
      if (Number.isFinite(date.getTime())) {
        const pad = (n) => `${n}`.padStart(2, "0");
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const hh = pad(date.getHours());
        const mm = pad(date.getMinutes());
        return `${y}-${m}-${d} ${hh}:${mm}`;
      }
      const text = `${time}`;
      if (text.includes("T"))
        return text.replace("T", " ").slice(0, 16);
      return text.slice(0, 16);
    },
    extractDay(time) {
      if (!time)
        return "";
      const date = new Date(time);
      if (Number.isFinite(date.getTime())) {
        const pad = (n) => `${n}`.padStart(2, "0");
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        return `${y}-${m}-${d}`;
      }
      const text = `${time}`;
      if (text.includes("T"))
        return text.slice(0, 10);
      return text.slice(0, 10);
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
    }
  }
};
if (!Array) {
  const _component_IngredientIcon = common_vendor.resolveComponent("IngredientIcon");
  const _component_LocationIcon = common_vendor.resolveComponent("LocationIcon");
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  (_component_IngredientIcon + _component_LocationIcon + _component_BottomNav)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.goBack && $options.goBack(...args)),
    b: $data.records.length > 0
  }, $data.records.length > 0 ? {
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
    o: $options.filteredRecords.length === 0
  }, $options.filteredRecords.length === 0 ? {
    p: common_vendor.t($data.records.length === 0 ? "暂无记录，右滑食材并点击“已取出”后会显示在这里。" : "当前时间范围内暂无记录，可切换到“全部”查看。")
  } : {}, {
    q: common_vendor.f($options.filteredRecords, (record, k0, i0) => {
      return {
        a: "8993cd31-0-" + i0,
        b: common_vendor.p({
          name: record.name,
          category: record.category,
          size: 36
        }),
        c: common_vendor.t(record.name),
        d: common_vendor.t(record.quantity),
        e: common_vendor.t(record.unit),
        f: "8993cd31-1-" + i0,
        g: common_vendor.p({
          location: record.location,
          size: 13,
          color: "#8fb7e8"
        }),
        h: common_vendor.t(record.location),
        i: common_vendor.t($options.formatDateTime(record.time)),
        j: record.id
      };
    }),
    r: common_vendor.p({
      current: "profile"
    }),
    s: `${_ctx.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-8993cd31"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/profile/takeout-records.js.map
