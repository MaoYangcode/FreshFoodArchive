"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const api_modules_ai = require("../../api/modules/ai.js");
const api_modules_shelfLife = require("../../api/modules/shelf-life.js");
const utils_currentUser = require("../../utils/current-user.js");
const utils_shelfLife = require("../../utils/shelf-life.js");
const BottomNav = () => "../../components/bottom-nav.js";
const LocationIcon = () => "../../components/location-icon.js";
const _sfc_main = {
  components: { BottomNav, LocationIcon },
  data() {
    return {
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
      userId: utils_currentUser.getCurrentUserId(),
      shelfLifeDaysByCategory: { ...utils_shelfLife.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY },
      isVoiceRecording: false,
      voiceSupported: false,
      batchVisible: false,
      batchSubmitting: false,
      batchItems: [],
      form: {
        name: "",
        category: "",
        quantity: "",
        unit: "",
        location: "",
        expireDate: ""
      },
      recorderManager: null
    };
  },
  computed: {
    batchSelectedCount() {
      return this.batchItems.filter((item) => item.selected !== false).length;
    }
  },
  async onShow() {
    this.userId = utils_currentUser.getCurrentUserId();
    await this.loadShelfLifeSettings();
  },
  onLoad() {
    if (typeof common_vendor.index.getRecorderManager !== "function")
      return;
    const manager = common_vendor.index.getRecorderManager();
    if (!manager || typeof manager.onStop !== "function" || typeof manager.start !== "function")
      return;
    manager.onStop((res) => {
      this.onVoiceRecordStop(res);
    });
    manager.onError(() => {
      this.isVoiceRecording = false;
      common_vendor.index.hideLoading();
      common_vendor.index.showToast({ title: "录音失败，请重试", icon: "none" });
    });
    this.recorderManager = manager;
    this.voiceSupported = true;
  },
  onUnload() {
    if (this.isVoiceRecording && this.recorderManager) {
      this.recorderManager.stop();
    }
  },
  methods: {
    async loadShelfLifeSettings() {
      var _a;
      try {
        const res = await api_modules_shelfLife.getShelfLifeSettings(this.userId);
        const rules = (res == null ? void 0 : res.rules) || ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.rules) || {};
        this.shelfLifeDaysByCategory = utils_shelfLife.normalizeShelfLifeDaysByCategory(rules);
      } catch (e) {
        this.shelfLifeDaysByCategory = { ...utils_shelfLife.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY };
      }
    },
    chooseLocalImage() {
      return new Promise((resolve, reject) => {
        common_vendor.index.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["camera", "album"],
          success: (res) => resolve(res),
          fail: (err) => reject(err)
        });
      });
    },
    toggleVoiceInput() {
      if (!this.voiceSupported || !this.recorderManager) {
        common_vendor.index.showToast({ title: "当前运行环境不支持语音录制", icon: "none" });
        return;
      }
      if (this.isVoiceRecording) {
        this.stopVoiceRecord();
        return;
      }
      this.startVoiceRecord();
    },
    startVoiceRecord() {
      if (!this.recorderManager)
        return;
      this.isVoiceRecording = true;
      common_vendor.index.showToast({ title: "开始录音，点“结束”完成", icon: "none" });
      this.recorderManager.start({
        duration: 15e3,
        sampleRate: 16e3,
        numberOfChannels: 1,
        encodeBitRate: 96e3,
        format: "mp3"
      });
    },
    stopVoiceRecord() {
      if (!this.recorderManager)
        return;
      common_vendor.index.showLoading({ title: "语音识别中..." });
      this.recorderManager.stop();
    },
    async onVoiceRecordStop(res) {
      var _a, _b, _c, _d, _e;
      this.isVoiceRecording = false;
      const filePath = res == null ? void 0 : res.tempFilePath;
      if (!filePath) {
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "录音文件为空", icon: "none" });
        return;
      }
      try {
        const result = await api_modules_ai.recognizeAudioByUpload(filePath);
        const text = `${((_a = result == null ? void 0 : result.data) == null ? void 0 : _a.text) || ""}`.trim();
        const parsedItems = Array.isArray((_b = result == null ? void 0 : result.data) == null ? void 0 : _b.items) ? result.data.items : [];
        const parsedName = `${((_c = result == null ? void 0 : result.data) == null ? void 0 : _c.name) || ""}`.trim();
        const parsedQuantity = Number((_d = result == null ? void 0 : result.data) == null ? void 0 : _d.quantity);
        const parsedUnit = `${((_e = result == null ? void 0 : result.data) == null ? void 0 : _e.unit) || ""}`.trim();
        if (!text) {
          common_vendor.index.showToast({ title: "未识别到语音内容", icon: "none" });
          return;
        }
        if (parsedItems.length > 1) {
          this.batchItems = parsedItems.map(
            (item) => this.normalizeRecognizedItem({
              name: item == null ? void 0 : item.name,
              category: item == null ? void 0 : item.category,
              quantity: item == null ? void 0 : item.quantity,
              unit: item == null ? void 0 : item.unit
            })
          );
          this.batchVisible = true;
          common_vendor.index.showToast({ title: `语音识别到${parsedItems.length}条，请确认`, icon: "none" });
          return;
        }
        const firstItem = parsedItems[0] || {};
        const nextName = parsedName || text;
        this.form.name = `${(firstItem == null ? void 0 : firstItem.name) || nextName}`.trim();
        const finalQuantity = Number(firstItem == null ? void 0 : firstItem.quantity);
        if (Number.isFinite(finalQuantity) && finalQuantity > 0) {
          this.form.quantity = `${finalQuantity}`;
        } else if (Number.isFinite(parsedQuantity) && parsedQuantity > 0) {
          this.form.quantity = `${parsedQuantity}`;
        }
        const finalUnit = `${(firstItem == null ? void 0 : firstItem.unit) || parsedUnit || ""}`.trim();
        const normalizedUnit = this.normalizeVoiceUnit(finalUnit, this.form.name, this.form.category);
        if (normalizedUnit)
          this.form.unit = normalizedUnit;
        const voiceCategory = this.categories.includes(firstItem == null ? void 0 : firstItem.category) ? firstItem.category : "";
        if (voiceCategory) {
          this.form.category = voiceCategory;
          this.form.expireDate = this.getExpireDateByCategory(voiceCategory);
        }
        common_vendor.index.showToast({ title: "已填入名称/数量/单位", icon: "none" });
      } catch (e) {
        const msg = `${(e == null ? void 0 : e.message) || ""}`.trim() || "语音识别失败，请重试";
        common_vendor.index.showToast({ title: msg, icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    },
    normalizeVoiceUnit(unit, name, category) {
      const text = `${unit || ""}`.trim();
      if (!text)
        return "";
      if (this.units.includes(text))
        return text;
      const aliasMap = {
        公斤: "公斤",
        千克: "千克",
        克: "克",
        斤: "斤",
        两: "两",
        个: "个",
        颗: "颗",
        袋: "袋",
        包: "包",
        瓶: "瓶",
        盒: "盒",
        罐: "罐",
        把: "把",
        根: "根",
        条: "条",
        片: "片",
        块: "块",
        份: "份",
        毫升: "毫升",
        升: "升"
      };
      const mapped = aliasMap[text];
      if (mapped && this.units.includes(mapped))
        return mapped;
      return this.normalizeRecognizedUnit(text, name, category);
    },
    recognizeIngredient() {
      this.startRecognize("ingredient");
    },
    recognizeReceipt() {
      this.startRecognize("receipt");
    },
    async startRecognize(mode = "ingredient") {
      var _a, _b;
      try {
        const chooseRes = await this.chooseLocalImage();
        const filePath = (_a = chooseRes == null ? void 0 : chooseRes.tempFilePaths) == null ? void 0 : _a[0];
        if (!filePath)
          return;
        const loadingText = mode === "receipt" ? "小票识别中..." : "识别中...";
        common_vendor.index.showLoading({ title: loadingText });
        const res = mode === "receipt" ? await api_modules_ai.recognizeReceiptByUpload(filePath) : await api_modules_ai.recognizeIngredientsByUpload(filePath);
        const list = Array.isArray((_b = res == null ? void 0 : res.data) == null ? void 0 : _b.ingredients) ? res.data.ingredients : [];
        if (!list.length) {
          const msg = mode === "receipt" ? "未识别到小票食材条目" : "未识别到食材";
          common_vendor.index.showToast({ title: msg, icon: "none" });
          return;
        }
        this.batchItems = list.map((item) => this.normalizeRecognizedItem(item));
        this.batchVisible = true;
        common_vendor.index.showToast({ title: `识别到${list.length}条，请确认`, icon: "none" });
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/add.vue:388", "识别失败", e);
        const msg = `${(e == null ? void 0 : e.message) || ""}`.trim() || "识别失败，请重试";
        common_vendor.index.showToast({ title: msg, icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    },
    normalizeRecognizedItem(item) {
      const category = this.categories.includes(item == null ? void 0 : item.category) ? item.category : "其他";
      const quantity = (item == null ? void 0 : item.quantity) || (item == null ? void 0 : item.quantity) === 0 ? `${item.quantity}` : "1";
      const name = (item == null ? void 0 : item.name) ? `${item.name}` : "";
      const unit = this.normalizeRecognizedUnit(item == null ? void 0 : item.unit, name, category);
      return {
        name,
        category,
        quantity,
        unit,
        location: this.form.location || "冷藏",
        expireDate: this.form.expireDate || this.getExpireDateByCategory(category),
        selected: true
      };
    },
    getExpireDateByCategory(category) {
      const days = utils_shelfLife.getShelfLifeDays(category, this.shelfLifeDaysByCategory);
      const date = /* @__PURE__ */ new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + days);
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, "0");
      const d = `${date.getDate()}`.padStart(2, "0");
      return `${y}-${m}-${d}`;
    },
    normalizeRecognizedUnit(rawUnit, name, category) {
      const fallback = this.inferUnitByName(name, category);
      const text = `${rawUnit || ""}`.trim();
      if (!text)
        return fallback;
      if (this.units.includes(text))
        return text;
      const key = text.toLowerCase();
      const aliasMap = {
        g: "克",
        gram: "克",
        grams: "克",
        kg: "千克",
        kgs: "千克",
        kilogram: "千克",
        kilograms: "千克",
        ml: "毫升",
        milliliter: "毫升",
        milliliters: "毫升",
        l: "升",
        liter: "升",
        liters: "升",
        jin: "斤",
        liang: "两",
        piece: "个",
        pieces: "个",
        pc: "个",
        box: "盒",
        can: "罐",
        pack: "包",
        bag: "袋",
        bottle: "瓶",
        strip: "条",
        slice: "片",
        stick: "根",
        block: "块",
        group: "组",
        handful: "把",
        cup: "杯",
        bowl: "碗",
        plate: "盘",
        roll: "卷",
        section: "段",
        basket: "篮",
        bundle: "捆",
        string: "串",
        row: "排",
        bucket: "桶",
        case: "箱",
        tube: "管"
      };
      const mapped = aliasMap[key] || aliasMap[key.replace(/\./g, "")];
      if (mapped && this.units.includes(mapped))
        return mapped;
      return fallback;
    },
    inferUnitByName(name, category) {
      const text = `${name || ""}`.toLowerCase();
      const cat = `${category || ""}`;
      if (/牛奶|酸奶|饮料|果汁|可乐|雪碧|豆浆|啤酒|矿泉水|椰汁|苏打/.test(text))
        return "毫升";
      if (/牛肉|猪肉|鸡胸|鸡肉|排骨|肉糜|肉馅|虾仁|鱼片/.test(text))
        return "克";
      if (/鸡蛋|鹌鹑蛋/.test(text))
        return "颗";
      if (/面条|米线|粉丝/.test(text))
        return "包";
      if (/豆腐|年糕/.test(text))
        return "块";
      if (cat === "肉类")
        return "克";
      if (cat === "饮料")
        return "毫升";
      return "个";
    },
    onBatchCategoryChange(index, e) {
      const category = this.categories[e.detail.value];
      this.batchItems[index].category = category;
      this.batchItems[index].expireDate = this.getExpireDateByCategory(category);
    },
    onBatchUnitChange(index, e) {
      this.batchItems[index].unit = this.units[e.detail.value];
    },
    onBatchLocationChange(index, e) {
      this.batchItems[index].location = this.locations[e.detail.value];
    },
    onBatchExpireDateChange(index, e) {
      var _a;
      const value = ((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value) || "";
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (value && value < today) {
        common_vendor.index.showToast({ title: `第${index + 1}条过期时间不能早于今天`, icon: "none" });
        this.batchItems[index].expireDate = "";
        return;
      }
      this.batchItems[index].expireDate = value;
    },
    toggleBatchSelected(index) {
      this.batchItems[index].selected = this.batchItems[index].selected === false;
    },
    toggleBatchSelectAll() {
      const next = this.batchSelectedCount !== this.batchItems.length;
      this.batchItems = this.batchItems.map((item) => ({ ...item, selected: next }));
    },
    closeBatchPanel() {
      this.batchVisible = false;
      this.batchItems = [];
    },
    getBatchQuantity(item) {
      const n = Number(item == null ? void 0 : item.quantity);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
    },
    decreaseBatchQty(index) {
      const current = this.getBatchQuantity(this.batchItems[index]);
      this.batchItems[index].quantity = `${Math.max(1, current - 1)}`;
    },
    increaseBatchQty(index) {
      const current = this.getBatchQuantity(this.batchItems[index]);
      this.batchItems[index].quantity = `${current + 1}`;
    },
    validateBatchItem(item, index) {
      if (!item.name || !item.category || !item.quantity || !item.unit || !item.location || !item.expireDate) {
        common_vendor.index.showToast({ title: `第${index + 1}条信息不完整`, icon: "none" });
        return false;
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        common_vendor.index.showToast({ title: `第${index + 1}条数量不合法`, icon: "none" });
        return false;
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (item.expireDate < today) {
        common_vendor.index.showToast({ title: `第${index + 1}条过期时间过早`, icon: "none" });
        return false;
      }
      return true;
    },
    async submitBatch() {
      if (!this.batchItems.length || this.batchSubmitting)
        return;
      const selectedItems = this.batchItems.filter((item) => item.selected !== false);
      if (!selectedItems.length) {
        common_vendor.index.showToast({ title: "请至少勾选一条食材", icon: "none" });
        return;
      }
      for (let i = 0; i < selectedItems.length; i += 1) {
        if (!this.validateBatchItem(selectedItems[i], i))
          return;
      }
      this.batchSubmitting = true;
      common_vendor.index.showLoading({ title: "批量入库中..." });
      try {
        for (const item of selectedItems) {
          await api_modules_ingredients.createIngredient({
            name: item.name,
            category: item.category,
            quantity: Number(item.quantity),
            unit: item.unit,
            location: item.location,
            expireDate: item.expireDate || null,
            userId: this.userId
          });
        }
        common_vendor.index.showToast({ title: `成功入库${selectedItems.length}条`, icon: "success" });
        this.closeBatchPanel();
        setTimeout(() => {
          common_vendor.index.navigateBack({ delta: 1 });
        }, 300);
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/add.vue:578", "批量新增失败", e);
        common_vendor.index.showToast({ title: "批量入库失败，请重试", icon: "none" });
      } finally {
        this.batchSubmitting = false;
        common_vendor.index.hideLoading();
      }
    },
    onCategoryChange(e) {
      const category = this.categories[e.detail.value];
      this.form.category = category;
      this.form.expireDate = this.getExpireDateByCategory(category);
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
    async submit() {
      if (!this.form.name || !this.form.category || !this.form.quantity || !this.form.unit || !this.form.location || !this.form.expireDate) {
        common_vendor.index.showToast({ title: "请先填写完整信息", icon: "none" });
        return;
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      if (this.form.expireDate < today) {
        common_vendor.index.showToast({ title: "过期日期不能早于今天", icon: "none" });
        return;
      }
      try {
        await api_modules_ingredients.createIngredient({
          name: this.form.name,
          category: this.form.category,
          quantity: Number(this.form.quantity),
          unit: this.form.unit,
          location: this.form.location,
          expireDate: this.form.expireDate || null,
          userId: this.userId
        });
        common_vendor.index.showToast({ title: "保存成功", icon: "success" });
        setTimeout(() => {
          common_vendor.index.navigateBack({
            delta: 1
          });
        }, 300);
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/add.vue:637", "新增失败", e);
        common_vendor.index.showToast({
          title: "保存失败",
          icon: "none"
        });
      }
    }
  }
};
if (!Array) {
  const _component_LocationIcon = common_vendor.resolveComponent("LocationIcon");
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  (_component_LocationIcon + _component_BottomNav)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: `${_ctx.navRightGap}px`,
    b: common_vendor.o((...args) => $options.recognizeIngredient && $options.recognizeIngredient(...args)),
    c: common_vendor.o((...args) => $options.recognizeReceipt && $options.recognizeReceipt(...args)),
    d: $data.batchVisible
  }, $data.batchVisible ? {
    e: common_vendor.t($data.batchItems.length),
    f: common_vendor.t($options.batchSelectedCount === $data.batchItems.length ? "取消全选" : "全选"),
    g: common_vendor.o((...args) => $options.toggleBatchSelectAll && $options.toggleBatchSelectAll(...args)),
    h: common_vendor.o((...args) => $options.closeBatchPanel && $options.closeBatchPanel(...args)),
    i: common_vendor.f($data.batchItems, (item, idx, i0) => {
      return common_vendor.e({
        a: item.selected
      }, item.selected ? {} : {}, {
        b: item.selected ? 1 : "",
        c: common_vendor.o(($event) => $options.toggleBatchSelected(idx), idx),
        d: item.name,
        e: common_vendor.o(($event) => item.name = $event.detail.value, idx),
        f: common_vendor.o(($event) => $options.decreaseBatchQty(idx), idx),
        g: common_vendor.t($options.getBatchQuantity(item)),
        h: common_vendor.o(($event) => $options.increaseBatchQty(idx), idx),
        i: common_vendor.t(item.unit || "单位"),
        j: common_vendor.o(($event) => $options.onBatchUnitChange(idx, $event), idx),
        k: "256b9a2d-0-" + i0,
        l: common_vendor.p({
          location: item.location,
          size: 14,
          color: "#6f9fea"
        }),
        m: common_vendor.t(item.location || "分区"),
        n: common_vendor.o(($event) => $options.onBatchLocationChange(idx, $event), idx),
        o: common_vendor.t(item.category || "类型"),
        p: common_vendor.o(($event) => $options.onBatchCategoryChange(idx, $event), idx),
        q: common_vendor.t(item.expireDate || "过期时间"),
        r: item.expireDate,
        s: common_vendor.o(($event) => $options.onBatchExpireDateChange(idx, $event), idx),
        t: !item.selected ? 1 : "",
        v: idx
      });
    }),
    j: $data.units,
    k: $data.locations,
    l: $data.categories,
    m: common_vendor.t($data.batchSubmitting ? "入库中..." : "一键批量入库"),
    n: $data.batchSubmitting,
    o: common_vendor.o((...args) => $options.submitBatch && $options.submitBatch(...args)),
    p: common_vendor.o(() => {
    }),
    q: common_vendor.o((...args) => $options.closeBatchPanel && $options.closeBatchPanel(...args))
  } : {}, {
    r: $data.form.name,
    s: common_vendor.o(($event) => $data.form.name = $event.detail.value),
    t: $data.isVoiceRecording ? 1 : "",
    v: !$data.voiceSupported ? 1 : "",
    w: common_vendor.o((...args) => $options.toggleVoiceInput && $options.toggleVoiceInput(...args)),
    x: common_vendor.t($data.form.category || "请选择类型"),
    y: $data.categories,
    z: common_vendor.o((...args) => $options.onCategoryChange && $options.onCategoryChange(...args)),
    A: $data.form.quantity,
    B: common_vendor.o(($event) => $data.form.quantity = $event.detail.value),
    C: common_vendor.t($data.form.unit || "份"),
    D: $data.units,
    E: common_vendor.o((...args) => $options.onUnitChange && $options.onUnitChange(...args)),
    F: common_vendor.f($data.locations, (loc, k0, i0) => {
      return {
        a: common_vendor.t(loc),
        b: loc,
        c: $data.form.location === loc ? 1 : "",
        d: common_vendor.o(($event) => $data.form.location = loc, loc)
      };
    }),
    G: common_vendor.t($data.form.expireDate || "选择过期时间"),
    H: $data.form.expireDate,
    I: common_vendor.o((...args) => $options.onDateChange && $options.onDateChange(...args)),
    J: common_vendor.o((...args) => $options.submit && $options.submit(...args)),
    K: common_vendor.p({
      current: "add"
    }),
    L: `${_ctx.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-256b9a2d"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/fridge/add.js.map
