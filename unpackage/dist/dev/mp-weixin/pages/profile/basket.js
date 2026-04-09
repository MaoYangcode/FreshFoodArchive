"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_shelfLife = require("../../api/modules/shelf-life.js");
const utils_currentUser = require("../../utils/current-user.js");
const utils_shelfLife = require("../../utils/shelf-life.js");
const api_modules_basket = require("../../api/modules/basket.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const LocationIcon = () => "../../components/location-icon.js";
const _sfc_main = {
  components: { BottomNav, IngredientIcon, LocationIcon },
  data() {
    return {
      userId: utils_currentUser.getCurrentUserId(),
      items: [],
      statusFilter: "all",
      keyword: "",
      dialogVisible: false,
      restockDialogVisible: false,
      categories: ["水果", "蔬菜", "肉类", "蛋奶", "海鲜", "饮料", "调味品", "其他"],
      restockLocationOptions: ["冷藏", "冷冻"],
      restockEntries: [],
      restockShelfLifeDaysByCategory: { ...utils_shelfLife.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY },
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
      form: {
        name: "",
        quantity: "1",
        unit: "份",
        category: ""
      },
      statusUpdatingMap: {},
      statusSyncedMap: {},
      statusDesiredMap: {}
    };
  },
  computed: {
    stats() {
      const todo = this.items.filter((x) => x.status !== "done").length;
      const done = this.items.filter((x) => x.status === "done").length;
      return { todo, done };
    },
    filteredItems() {
      const key = `${this.keyword || ""}`.trim().toLowerCase();
      return this.items.filter((item) => {
        if (this.statusFilter === "todo" && item.status === "done")
          return false;
        if (this.statusFilter === "done" && item.status !== "done")
          return false;
        if (key) {
          const text = `${item.name || ""} ${item.category || ""} ${item.sourceRecipeName || ""}`.toLowerCase();
          if (!text.includes(key))
            return false;
        }
        return true;
      });
    },
    doneItems() {
      return this.items.filter((x) => x.status === "done");
    }
  },
  async onShow() {
    this.userId = utils_currentUser.getCurrentUserId();
    await this.loadShelfLifeSettings();
    this.refresh();
  },
  methods: {
    async loadShelfLifeSettings() {
      var _a;
      try {
        const res = await api_modules_shelfLife.getShelfLifeSettings(this.userId);
        const rules = (res == null ? void 0 : res.rules) || ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.rules) || {};
        this.restockShelfLifeDaysByCategory = utils_shelfLife.normalizeShelfLifeDaysByCategory(rules);
      } catch (e) {
        this.restockShelfLifeDaysByCategory = { ...utils_shelfLife.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY };
      }
    },
    async refresh() {
      try {
        const res = await api_modules_basket.getBasketItems(this.userId);
        this.items = Array.isArray(res) ? res : [];
        const synced = {};
        this.items.forEach((item) => {
          if (!item || !item.id)
            return;
          synced[item.id] = item.status === "done" ? "done" : "todo";
        });
        this.statusSyncedMap = synced;
        this.statusDesiredMap = { ...synced };
      } catch (e) {
        this.items = [];
        common_vendor.index.showToast({ title: "菜篮子加载失败", icon: "none" });
      }
    },
    goBack() {
      common_vendor.index.navigateBack();
    },
    onKeywordInput(e) {
      this.keyword = e && e.detail ? `${e.detail.value || ""}` : "";
    },
    isStatusUpdating(id) {
      return Boolean(this.statusUpdatingMap && this.statusUpdatingMap[id]);
    },
    getItemById(id) {
      return this.items.find((entry) => entry.id === id) || null;
    },
    setItemStatus(id, status) {
      this.items = this.items.map((entry) => entry.id === id ? { ...entry, status } : entry);
    },
    async flushStatusSync(id) {
      if (!id || this.isStatusUpdating(id))
        return;
      const desired = this.statusDesiredMap[id];
      const synced = this.statusSyncedMap[id];
      if (!desired || !synced || desired === synced)
        return;
      this.$set(this.statusUpdatingMap, id, true);
      try {
        await api_modules_basket.toggleBasketItemStatus(id, this.userId);
        const nextSynced = synced === "done" ? "todo" : "done";
        this.$set(this.statusSyncedMap, id, nextSynced);
      } catch (e) {
        this.setItemStatus(id, synced);
        this.$set(this.statusDesiredMap, id, synced);
        common_vendor.index.showToast({ title: "更新失败", icon: "none" });
      } finally {
        this.$delete(this.statusUpdatingMap, id);
      }
      const finalDesired = this.statusDesiredMap[id];
      const finalSynced = this.statusSyncedMap[id];
      if (finalDesired && finalSynced && finalDesired !== finalSynced) {
        this.flushStatusSync(id);
      }
    },
    async toggleStatus(item) {
      if (!item || !item.id)
        return;
      const id = item.id;
      const current = this.getItemById(id);
      if (!current)
        return;
      const nextStatus = current.status === "done" ? "todo" : "done";
      this.setItemStatus(id, nextStatus);
      this.$set(this.statusDesiredMap, id, nextStatus);
      this.flushStatusSync(id);
    },
    async removeOne(item) {
      try {
        await api_modules_basket.removeBasketItem(item.id, this.userId);
        this.refresh();
        common_vendor.index.showToast({ title: "已删除", icon: "none" });
      } catch (e) {
        common_vendor.index.showToast({ title: "删除失败", icon: "none" });
      }
    },
    async clearDone() {
      try {
        await api_modules_basket.clearDoneBasketItems(this.userId);
        this.refresh();
        common_vendor.index.showToast({ title: "已清空已购买", icon: "none" });
      } catch (e) {
        common_vendor.index.showToast({ title: "清空失败", icon: "none" });
      }
    },
    getTodayDateText() {
      const date = /* @__PURE__ */ new Date();
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, "0");
      const d = `${date.getDate()}`.padStart(2, "0");
      return `${y}-${m}-${d}`;
    },
    getExpireDateByCategory(category, baseDateText = "") {
      var _a, _b;
      const days = Number(((_a = this.restockShelfLifeDaysByCategory) == null ? void 0 : _a[category]) || ((_b = this.restockShelfLifeDaysByCategory) == null ? void 0 : _b["其他"]) || 7);
      const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 7;
      const base = baseDateText ? new Date(baseDateText) : /* @__PURE__ */ new Date();
      const date = Number.isNaN(base.getTime()) ? /* @__PURE__ */ new Date() : base;
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + safeDays);
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, "0");
      const d = `${date.getDate()}`.padStart(2, "0");
      return `${y}-${m}-${d}`;
    },
    openRestockDialog() {
      if (!this.doneItems.length) {
        common_vendor.index.showToast({ title: "暂无已购购买项", icon: "none" });
        return;
      }
      const today = this.getTodayDateText();
      this.restockEntries = this.doneItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category || "其他",
        quantity: Number(item.quantity || 1),
        unit: item.unit || "份",
        location: "冷藏",
        restockDate: today,
        expireDate: this.getExpireDateByCategory(item.category || "其他", today)
      }));
      this.restockDialogVisible = true;
    },
    closeRestockDialog() {
      this.restockDialogVisible = false;
      this.restockEntries = [];
    },
    onRestockLocationChange(index, e) {
      const idx = Number(e && e.detail ? e.detail.value : 0);
      if (!this.restockEntries[index])
        return;
      this.restockEntries[index].location = this.restockLocationOptions[idx] || "冷藏";
    },
    onRestockDateChange(index, e) {
      if (!this.restockEntries[index])
        return;
      const value = e && e.detail ? `${e.detail.value || ""}` : this.getTodayDateText();
      this.restockEntries[index].expireDate = value || this.getTodayDateText();
    },
    onRestockCategoryChange(index, e) {
      if (!this.restockEntries[index])
        return;
      const idx = Number(e && e.detail ? e.detail.value : 0);
      const category = this.categories[idx] || "其他";
      this.restockEntries[index].category = category;
      this.restockEntries[index].expireDate = this.getExpireDateByCategory(
        category,
        this.restockEntries[index].restockDate || this.getTodayDateText()
      );
    },
    increaseRestockQty(index) {
      if (!this.restockEntries[index])
        return;
      const current = Number(this.restockEntries[index].quantity || 1);
      this.restockEntries[index].quantity = Number.isFinite(current) && current > 0 ? current + 1 : 2;
    },
    decreaseRestockQty(index) {
      if (!this.restockEntries[index])
        return;
      const current = Number(this.restockEntries[index].quantity || 1);
      const safeCurrent = Number.isFinite(current) && current > 0 ? current : 1;
      this.restockEntries[index].quantity = Math.max(1, safeCurrent - 1);
    },
    onRestockUnitChange(index, e) {
      if (!this.restockEntries[index])
        return;
      const idx = Number(e && e.detail ? e.detail.value : 0);
      this.restockEntries[index].unit = this.units[idx] || "份";
    },
    async submitRestock() {
      try {
        if (!this.restockEntries.length) {
          common_vendor.index.showToast({ title: "暂无可入库购买项", icon: "none" });
          return;
        }
        const res = await api_modules_basket.restockDoneBasketItems({
          userId: this.userId,
          restockDate: this.getTodayDateText(),
          location: "冷藏",
          defaultShelfLifeDays: 7,
          shelfLifeDaysByCategory: this.restockShelfLifeDaysByCategory,
          itemSettings: this.restockEntries.map((entry) => ({
            id: entry.id,
            restockDate: entry.restockDate || this.getTodayDateText(),
            expireDate: entry.expireDate || this.getTodayDateText(),
            location: entry.location || "冷藏",
            category: entry.category || "其他",
            quantity: Number(entry.quantity || 1),
            unit: entry.unit || "份"
          }))
        });
        this.closeRestockDialog();
        await this.refresh();
        const created = Number(res && res.created ? res.created : 0);
        common_vendor.index.showToast({
          title: created > 0 ? `已入库${created}项` : "没有可入库购买项",
          icon: "none"
        });
      } catch (e) {
        common_vendor.index.showToast({ title: "补货失败，请重试", icon: "none" });
      }
    },
    openAddDialog() {
      this.dialogVisible = true;
    },
    closeDialog() {
      this.dialogVisible = false;
      this.form = { name: "", quantity: "1", unit: "份", category: "" };
    },
    onUnitChange(e) {
      this.form.unit = this.units[e.detail.value];
    },
    onCategoryChange(e) {
      this.form.category = this.categories[e.detail.value];
    },
    async submitDialog() {
      if (!`${this.form.name || ""}`.trim()) {
        common_vendor.index.showToast({ title: "请输入食材名", icon: "none" });
        return;
      }
      try {
        await api_modules_basket.addBasketItem({
          userId: this.userId,
          name: this.form.name,
          quantity: Number(this.form.quantity || 1),
          unit: this.form.unit || "份",
          category: this.form.category || "其他"
        });
        this.closeDialog();
        this.refresh();
        common_vendor.index.showToast({ title: "已加入菜篮子", icon: "success" });
      } catch (e) {
        common_vendor.index.showToast({ title: "新增失败", icon: "none" });
      }
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
    b: common_vendor.t($options.stats.todo),
    c: $data.statusFilter === "all" ? 1 : "",
    d: common_vendor.o(($event) => $data.statusFilter = "all"),
    e: $data.statusFilter === "todo" ? 1 : "",
    f: common_vendor.o(($event) => $data.statusFilter = "todo"),
    g: $data.statusFilter === "done" ? 1 : "",
    h: common_vendor.o(($event) => $data.statusFilter = "done"),
    i: $data.keyword,
    j: common_vendor.o((...args) => $options.onKeywordInput && $options.onKeywordInput(...args)),
    k: common_vendor.o((...args) => $options.openAddDialog && $options.openAddDialog(...args)),
    l: $options.stats.done === 0,
    m: common_vendor.o((...args) => $options.openRestockDialog && $options.openRestockDialog(...args)),
    n: $options.filteredItems.length === 0
  }, $options.filteredItems.length === 0 ? {
    o: common_vendor.t($data.items.length === 0 ? "还没有菜篮子购买项" : "当前条件下暂无购买项"),
    p: common_vendor.t($data.items.length === 0 ? "可从菜谱详情把缺少食材加入进来。" : "试试切换筛选或清空搜索关键词。")
  } : {}, {
    q: common_vendor.f($options.filteredItems, (item, k0, i0) => {
      return common_vendor.e({
        a: item.status === "done"
      }, item.status === "done" ? {} : {}, {
        b: item.status === "done" ? 1 : "",
        c: $options.isStatusUpdating(item.id) ? 1 : "",
        d: common_vendor.o(($event) => $options.toggleStatus(item), item.id),
        e: common_vendor.o(($event) => $options.toggleStatus(item), item.id),
        f: "0779153f-0-" + i0,
        g: common_vendor.p({
          name: item.name,
          category: item.category,
          size: 36
        }),
        h: common_vendor.t(item.name),
        i: item.status === "done" ? 1 : "",
        j: common_vendor.t(item.quantity),
        k: common_vendor.t(item.unit),
        l: common_vendor.t(item.category),
        m: item.sourceRecipeName
      }, item.sourceRecipeName ? {
        n: common_vendor.t(item.sourceRecipeName)
      } : {}, {
        o: common_vendor.t(item.status === "done" ? "已购买" : "待购买"),
        p: common_vendor.n(item.status === "done" ? "done" : "todo"),
        q: common_vendor.o(($event) => $options.toggleStatus(item), item.id),
        r: common_vendor.o(($event) => $options.toggleStatus(item), item.id),
        s: common_vendor.o(($event) => $options.removeOne(item), item.id),
        t: item.id
      });
    }),
    r: $data.dialogVisible
  }, $data.dialogVisible ? {
    s: $data.form.name,
    t: common_vendor.o(($event) => $data.form.name = $event.detail.value),
    v: $data.form.quantity,
    w: common_vendor.o(($event) => $data.form.quantity = $event.detail.value),
    x: common_vendor.t($data.form.unit || "份"),
    y: $data.units,
    z: common_vendor.o((...args) => $options.onUnitChange && $options.onUnitChange(...args)),
    A: common_vendor.t($data.form.category || "请选择类别"),
    B: $data.categories,
    C: common_vendor.o((...args) => $options.onCategoryChange && $options.onCategoryChange(...args)),
    D: common_vendor.o((...args) => $options.closeDialog && $options.closeDialog(...args)),
    E: common_vendor.o((...args) => $options.submitDialog && $options.submitDialog(...args)),
    F: common_vendor.o(() => {
    }),
    G: common_vendor.o((...args) => $options.closeDialog && $options.closeDialog(...args))
  } : {}, {
    H: $data.restockDialogVisible
  }, $data.restockDialogVisible ? {
    I: common_vendor.f($data.restockEntries, (entry, idx, i0) => {
      return {
        a: "0779153f-1-" + i0,
        b: common_vendor.p({
          name: entry.name,
          category: entry.category,
          size: 30
        }),
        c: common_vendor.t(entry.name),
        d: common_vendor.o(($event) => $options.decreaseRestockQty(idx), entry.id),
        e: common_vendor.t(entry.quantity),
        f: common_vendor.o(($event) => $options.increaseRestockQty(idx), entry.id),
        g: common_vendor.t(entry.unit || "份"),
        h: common_vendor.o(($event) => $options.onRestockUnitChange(idx, $event), entry.id),
        i: "0779153f-2-" + i0,
        j: common_vendor.p({
          location: entry.location,
          size: 14,
          color: "#6f9fea"
        }),
        k: common_vendor.t(entry.location || "冷藏"),
        l: common_vendor.o(($event) => $options.onRestockLocationChange(idx, $event), entry.id),
        m: common_vendor.t(entry.category || "其他"),
        n: common_vendor.o(($event) => $options.onRestockCategoryChange(idx, $event), entry.id),
        o: common_vendor.t(entry.expireDate || $options.getTodayDateText()),
        p: entry.expireDate,
        q: common_vendor.o(($event) => $options.onRestockDateChange(idx, $event), entry.id),
        r: entry.id
      };
    }),
    J: $data.units,
    K: $data.restockLocationOptions,
    L: $data.categories,
    M: common_vendor.o((...args) => $options.closeRestockDialog && $options.closeRestockDialog(...args)),
    N: common_vendor.o((...args) => $options.submitRestock && $options.submitRestock(...args)),
    O: common_vendor.o(() => {
    }),
    P: common_vendor.o((...args) => $options.closeRestockDialog && $options.closeRestockDialog(...args))
  } : {}, {
    Q: common_vendor.p({
      current: "profile"
    }),
    R: `${_ctx.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-0779153f"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/profile/basket.js.map
