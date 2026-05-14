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
        unit: "份",
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
    this.ensureShareMenu();
    this.userId = utils_currentUser.getCurrentUserId();
    await this.loadShelfLifeSettings();
  },
  onLoad() {
    this.ensureShareMenu();
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
  onShareAppMessage() {
    return {
      title: "我在鲜食档案快速添加食材，库存管理更轻松",
      path: "/pages/fridge/add"
    };
  },
  onShareTimeline() {
    return {
      title: "鲜食档案 | 拍照/语音快速添加食材"
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
        const voiceIntent = this.extractVoiceIntent(text);
        if (!text) {
          common_vendor.index.showToast({ title: "未识别到语音内容", icon: "none" });
          return;
        }
        if (parsedItems.length > 1) {
          const sharedLocation = this.normalizeVoiceLocation(voiceIntent.location || this.form.location || "冷藏");
          const sharedExpireDate = voiceIntent.expireDate || this.form.expireDate || "";
          this.batchItems = parsedItems.map(
            (item) => this.normalizeRecognizedItem({
              name: this.extractVoiceIntent(item == null ? void 0 : item.name).name || (item == null ? void 0 : item.name),
              category: item == null ? void 0 : item.category,
              quantity: (item == null ? void 0 : item.quantity) || this.extractVoiceIntent(item == null ? void 0 : item.name).quantity,
              unit: (item == null ? void 0 : item.unit) || this.extractVoiceIntent(item == null ? void 0 : item.name).unit,
              location: (item == null ? void 0 : item.location) || this.extractVoiceIntent(item == null ? void 0 : item.name).location
            }, sharedLocation, sharedExpireDate)
          );
          this.batchVisible = true;
          common_vendor.index.showToast({ title: `语音识别到${parsedItems.length}条，请确认`, icon: "none" });
          return;
        }
        const firstItem = parsedItems[0] || {};
        const firstIntent = this.extractVoiceIntent((firstItem == null ? void 0 : firstItem.name) || "");
        const parsedIntent = this.extractVoiceIntent(parsedName || "");
        const nextName = firstIntent.name || parsedIntent.name || voiceIntent.name || parsedName || text;
        this.form.name = `${nextName}`.trim();
        const finalQuantity = Number(firstItem == null ? void 0 : firstItem.quantity);
        if (Number.isFinite(finalQuantity) && finalQuantity > 0) {
          this.form.quantity = `${finalQuantity}`;
        } else if (Number.isFinite(parsedQuantity) && parsedQuantity > 0) {
          this.form.quantity = `${parsedQuantity}`;
        } else if (Number.isFinite(voiceIntent.quantity) && voiceIntent.quantity > 0) {
          this.form.quantity = `${voiceIntent.quantity}`;
        } else if (Number.isFinite(firstIntent.quantity) && firstIntent.quantity > 0) {
          this.form.quantity = `${firstIntent.quantity}`;
        }
        const finalUnit = `${(firstItem == null ? void 0 : firstItem.unit) || parsedUnit || firstIntent.unit || voiceIntent.unit || ""}`.trim();
        const normalizedUnit = this.normalizeVoiceUnit(finalUnit, this.form.name, this.form.category);
        if (normalizedUnit)
          this.form.unit = normalizedUnit;
        const voiceLocation = this.normalizeVoiceLocation((firstItem == null ? void 0 : firstItem.location) || firstIntent.location || voiceIntent.location);
        if (voiceLocation) {
          this.form.location = voiceLocation;
        }
        if (voiceIntent.expireDate) {
          this.form.expireDate = voiceIntent.expireDate;
        }
        const voiceCategory = this.categories.includes(firstItem == null ? void 0 : firstItem.category) ? firstItem.category : "";
        if (voiceCategory) {
          this.form.category = voiceCategory;
          if (!voiceIntent.expireDate) {
            this.form.expireDate = this.getExpireDateByCategory(voiceCategory);
          }
        }
        common_vendor.index.showToast({ title: "已填入名称/数量/单位/位置/过期日期", icon: "none" });
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
        common_vendor.index.__f__("error", "at pages/fridge/add.vue:428", "识别失败", e);
        const msg = `${(e == null ? void 0 : e.message) || ""}`.trim() || "识别失败，请重试";
        common_vendor.index.showToast({ title: msg, icon: "none" });
      } finally {
        common_vendor.index.hideLoading();
      }
    },
    normalizeRecognizedItem(item, fallbackLocation = "", fallbackExpireDate = "") {
      const category = this.categories.includes(item == null ? void 0 : item.category) ? item.category : "其他";
      const quantity = (item == null ? void 0 : item.quantity) || (item == null ? void 0 : item.quantity) === 0 ? `${item.quantity}` : "1";
      const intent = this.extractVoiceIntent((item == null ? void 0 : item.name) || "");
      const name = (item == null ? void 0 : item.name) ? `${intent.name || item.name}` : "";
      const unit = this.normalizeRecognizedUnit(item == null ? void 0 : item.unit, name, category);
      const location = this.normalizeVoiceLocation((item == null ? void 0 : item.location) || intent.location || fallbackLocation || this.form.location || "冷藏");
      const expireDate = this.normalizeVoiceExpireDate((item == null ? void 0 : item.expireDate) || intent.expireDate || fallbackExpireDate || this.form.expireDate);
      return {
        name,
        category,
        quantity,
        unit,
        location,
        expireDate: expireDate || this.getExpireDateByCategory(category),
        selected: true
      };
    },
    normalizeVoiceLocation(raw) {
      const text = `${raw || ""}`.trim();
      if (!text)
        return "";
      if (text.includes("冷冻") || text.includes("冷凍") || text.includes("冻起来") || text.includes("冷冻层") || text.includes("冷冻柜") || text.includes("冷冻室"))
        return "冷冻";
      if (text.includes("冷藏") || text.includes("冷藏室") || text.includes("冷藏层") || text.includes("保鲜") || text.includes("保鲜层") || text.includes("放冰箱") || text.includes("冰箱里"))
        return "冷藏";
      return "";
    },
    normalizeVoiceExpireDate(raw) {
      const text = `${raw || ""}`.trim();
      if (!text)
        return "";
      const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) {
        const y = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day))
          return "";
        const date = new Date(y, month - 1, day);
        if (!Number.isFinite(date.getTime()))
          return "";
        return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
      }
      return "";
    },
    formatDateOffset(days) {
      const n = Number(days);
      if (!Number.isFinite(n))
        return "";
      const date = /* @__PURE__ */ new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + Math.max(0, Math.floor(n)));
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, "0");
      const d = `${date.getDate()}`.padStart(2, "0");
      return `${y}-${m}-${d}`;
    },
    formatDateYmd(date) {
      if (!(date instanceof Date) || !Number.isFinite(date.getTime()))
        return "";
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, "0");
      const d = `${date.getDate()}`.padStart(2, "0");
      return `${y}-${m}-${d}`;
    },
    getUpcomingWeekdayDate(targetWeekday, weekOffset = 0) {
      const weekday = Number(targetWeekday);
      if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6)
        return "";
      const offset = Math.max(0, Number(weekOffset) || 0);
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const current = today.getDay();
      let delta = (weekday - current + 7) % 7;
      delta += offset * 7;
      if (offset === 0 && delta === 0)
        delta = 7;
      const target = new Date(today);
      target.setDate(today.getDate() + delta);
      return this.formatDateYmd(target);
    },
    getMonthEndDate(monthOffset = 0) {
      const offset = Math.max(0, Number(monthOffset) || 0);
      const now = /* @__PURE__ */ new Date();
      const date = new Date(now.getFullYear(), now.getMonth() + 1 + offset, 0);
      date.setHours(0, 0, 0, 0);
      return this.formatDateYmd(date);
    },
    parseVoiceExpireDate(text) {
      const raw = `${text || ""}`.trim();
      if (!raw)
        return "";
      const compact = raw.replace(/\s+/g, "");
      if (compact.includes("今天过期") || compact.includes("今日过期"))
        return this.formatDateOffset(0);
      if (compact.includes("明天过期"))
        return this.formatDateOffset(1);
      if (compact.includes("后天过期"))
        return this.formatDateOffset(2);
      const relativeDays = compact.match(/(?:过|再过|还有)?([零一二两三四五六七八九十百千万\d]+)天(?:后)?(?:过期|到期|吃完)?/) || compact.match(/([零一二两三四五六七八九十百千万\d]+)天(?:后)?/);
      if (relativeDays && relativeDays[1]) {
        const days = this.parseChineseVoiceNumber(relativeDays[1]);
        if (Number.isFinite(days) && days >= 0)
          return this.formatDateOffset(days);
      }
      const relativeWeeks = compact.match(/([零一二两三四五六七八九十百千万\d]+)周后(?:过期|到期|吃完)?/);
      if (relativeWeeks && relativeWeeks[1]) {
        const weeks = this.parseChineseVoiceNumber(relativeWeeks[1]);
        if (Number.isFinite(weeks) && weeks >= 0)
          return this.formatDateOffset(weeks * 7);
      }
      if (compact.includes("下下周"))
        return this.formatDateOffset(14);
      if (compact.includes("下周"))
        return this.formatDateOffset(7);
      const weekdayMap = {
        周日: 0,
        周天: 0,
        星期日: 0,
        星期天: 0,
        周一: 1,
        星期一: 1,
        周二: 2,
        星期二: 2,
        周三: 3,
        星期三: 3,
        周四: 4,
        星期四: 4,
        周五: 5,
        星期五: 5,
        周六: 6,
        星期六: 6
      };
      const weekdayMatch = compact.match(/(下下周|下周)?(周[一二三四五六日天]|星期[一二三四五六日天])(?:过期|到期|吃完)?/);
      if (weekdayMatch) {
        const prefix = `${weekdayMatch[1] || ""}`;
        const weekdayText = `${weekdayMatch[2] || ""}`;
        const targetWeekday = weekdayMap[weekdayText];
        const weekOffset = prefix === "下下周" ? 2 : prefix === "下周" ? 1 : 0;
        const date = this.getUpcomingWeekdayDate(targetWeekday, weekOffset);
        if (date)
          return date;
      }
      if (compact.includes("月底过期") || compact.includes("月末过期") || compact.includes("月末前吃完") || compact.includes("月底前吃完")) {
        return this.getMonthEndDate(0);
      }
      const isoDate = compact.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:过期|到期)?/);
      if (isoDate) {
        const y = Number(isoDate[1]);
        const month = Number(isoDate[2]);
        const day = Number(isoDate[3]);
        const date = new Date(y, month - 1, day);
        if (Number.isFinite(date.getTime()))
          return this.formatDateYmd(date);
      }
      const absolute = compact.match(/(\d{4})年(\d{1,2})月(\d{1,2})[日号]?(?:过期|到期)?/);
      if (absolute) {
        const y = Number(absolute[1]);
        const month = Number(absolute[2]);
        const day = Number(absolute[3]);
        const date = new Date(y, month - 1, day);
        if (Number.isFinite(date.getTime()))
          return this.formatDateYmd(date);
      }
      const absoluteZhYear = compact.match(/([零〇一二两三四五六七八九]{4})年([零一二两三四五六七八九十\d]{1,3})月([零一二两三四五六七八九十\d]{1,3})[日号]?(?:过期|到期)?/);
      if (absoluteZhYear) {
        const y = this.parseChineseYear(absoluteZhYear[1]);
        const month = this.parseChineseVoiceNumber(absoluteZhYear[2]);
        const day = this.parseChineseVoiceNumber(absoluteZhYear[3]);
        if (Number.isFinite(y) && Number.isFinite(month) && Number.isFinite(day)) {
          const date = new Date(y, Number(month) - 1, Number(day));
          if (Number.isFinite(date.getTime()))
            return this.formatDateYmd(date);
        }
      }
      const shortDate = compact.match(/(\d{1,2})月(\d{1,2})[日号]?(?:过期|到期)?/);
      if (shortDate) {
        const month = Number(shortDate[1]);
        const day = Number(shortDate[2]);
        if (!Number.isFinite(month) || !Number.isFinite(day))
          return "";
        const now = /* @__PURE__ */ new Date();
        const currentYear = now.getFullYear();
        let date = new Date(currentYear, month - 1, day);
        date.setHours(0, 0, 0, 0);
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        if (date.getTime() < today.getTime()) {
          date = new Date(currentYear + 1, month - 1, day);
          date.setHours(0, 0, 0, 0);
        }
        if (Number.isFinite(date.getTime()))
          return this.formatDateYmd(date);
      }
      const shortDateZh = compact.match(/([零一二两三四五六七八九十\d]{1,3})月([零一二两三四五六七八九十\d]{1,3})[日号]?(?:过期|到期)?/);
      if (shortDateZh) {
        const month = this.parseChineseVoiceNumber(shortDateZh[1]);
        const day = this.parseChineseVoiceNumber(shortDateZh[2]);
        if (!Number.isFinite(month) || !Number.isFinite(day))
          return "";
        const now = /* @__PURE__ */ new Date();
        const currentYear = now.getFullYear();
        let date = new Date(currentYear, Number(month) - 1, Number(day));
        date.setHours(0, 0, 0, 0);
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        if (date.getTime() < today.getTime()) {
          date = new Date(currentYear + 1, Number(month) - 1, Number(day));
          date.setHours(0, 0, 0, 0);
        }
        if (Number.isFinite(date.getTime()))
          return this.formatDateYmd(date);
      }
      return "";
    },
    parseChineseVoiceNumber(raw) {
      const text = `${raw || ""}`.trim();
      if (!text)
        return void 0;
      const num = Number(text);
      if (Number.isFinite(num) && num > 0)
        return num;
      const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      if (text.length === 1 && map[text] !== void 0)
        return map[text];
      if (text === "十一")
        return 11;
      if (text === "十二")
        return 12;
      if (text === "十三")
        return 13;
      if (text === "十四")
        return 14;
      if (text === "十五")
        return 15;
      if (text === "十六")
        return 16;
      if (text === "十七")
        return 17;
      if (text === "十八")
        return 18;
      if (text === "十九")
        return 19;
      if (text === "二十")
        return 20;
      return void 0;
    },
    parseChineseYear(raw) {
      const text = `${raw || ""}`.trim();
      if (!text)
        return void 0;
      const direct = Number(text);
      if (Number.isFinite(direct) && `${Math.floor(direct)}`.length === 4)
        return Math.floor(direct);
      const map = { 零: "0", "〇": "0", 一: "1", 二: "2", 两: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9" };
      let digits = "";
      for (const ch of text) {
        if (!map[ch])
          return void 0;
        digits += map[ch];
      }
      if (digits.length !== 4)
        return void 0;
      const year = Number(digits);
      return Number.isFinite(year) ? year : void 0;
    },
    cleanVoiceSemanticSuffix(text) {
      return `${text || ""}`.replace(/(放在|放到|放进|放入|存到|存入|放至|存至|冻起来|冻上)\s*(冷藏|冷藏室|冷藏层|冷冻|冷冻室|冷冻层|冷冻柜|保鲜层?|冰箱)/g, " ").replace(/(冷藏|冷藏室|冷藏层|冷冻|冷冻室|冷冻层|冷冻柜|保鲜层?|放冰箱|冰箱里)/g, " ").replace(
        /(?:过|再过|还有)?\s*[零一二两三四五六七八九十百千万\d]+\s*天(?:后)?(?:过期|到期|吃完)?|[零一二两三四五六七八九十百千万\d]+\s*周后(?:过期|到期|吃完)?|下下周(?:过期|到期|吃完)?|下周(?:过期|到期|吃完)?|(下下周|下周)?\s*(周[一二三四五六日天]|星期[一二三四五六日天])(?:过期|到期|吃完)?|今天过期|今日过期|明天过期|后天过期|月底过期|月末过期|月末前吃完|月底前吃完|\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}(?:过期|到期)?|\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*[日号]?(?:过期|到期)?|\d{1,2}\s*月\s*\d{1,2}\s*[日号]?(?:过期|到期)?|[零一二两三四五六七八九十〇]{4}\s*年\s*[零一二三四五六七八九十两\d]{1,3}\s*月\s*[零一二三四五六七八九十两\d]{1,3}\s*[日号]?(?:过期|到期)?|[零一二三四五六七八九十两\d]{1,3}\s*月\s*[零一二三四五六七八九十两\d]{1,3}\s*[日号]?(?:过期|到期)?/g,
        " "
      ).replace(/\s*(过期|到期|吃完)\s*$/g, " ").replace(/\s+/g, " ").trim();
    },
    extractVoiceIntent(rawText) {
      const origin = `${rawText || ""}`.trim();
      if (!origin)
        return { name: "", quantity: void 0, unit: "", location: "", expireDate: "" };
      let text = origin.replace(/[，,。；;！!？?]/g, " ").replace(/\s+/g, " ").trim();
      const location = this.normalizeVoiceLocation(text);
      const expireDate = this.parseVoiceExpireDate(text);
      text = this.cleanVoiceSemanticSuffix(text).replace(/^(帮我|请|麻烦|把|将|我要|我想|给我)\s*/g, "").trim();
      const match = text.match(
        /^([零一二两三四五六七八九十百千万\d]+(?:\.\d+)?)\s*(个|颗|斤|公斤|千克|克|袋|包|瓶|盒|罐|把|根|条|片|块|份|毫升|升)?\s*(.+)$/
      );
      let quantity;
      let unit = "";
      let name = text;
      if (match) {
        quantity = this.parseChineseVoiceNumber(match[1]);
        unit = `${match[2] || ""}`.trim();
        name = `${match[3] || ""}`.trim();
      }
      name = `${name || ""}`.replace(/^(一个|一份|一斤|一袋|一包|一盒|一瓶|一罐|一根|一条|一片|一块)\s*/g, "").replace(/(放在|放到|放进|放入|存到|存入|放至|存至)$/g, "").trim();
      return {
        name,
        quantity,
        unit,
        location,
        expireDate
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
        common_vendor.index.__f__("error", "at pages/fridge/add.vue:891", "批量新增失败", e);
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
    resetManualForm() {
      this.form = {
        name: "",
        category: "",
        quantity: "",
        unit: "份",
        location: "",
        expireDate: ""
      };
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
        this.resetManualForm();
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/add.vue:955", "新增失败", e);
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
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/fridge/add.js.map
