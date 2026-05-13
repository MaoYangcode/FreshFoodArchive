"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_expiryReminder = require("../../api/modules/expiry-reminder.js");
const utils_currentUser = require("../../utils/current-user.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const CATEGORIES = ["水果", "蔬菜", "肉类", "蛋奶", "海鲜", "饮料", "调味品", "其他"];
const DEV_SUBSCRIBE_TEMPLATE_IDS = ["Be9XDSuceuvjfxx01bjzV_yAh9T2WkvQt8ReSw0GUyw"];
const DEFAULT_SETTINGS = {
  enabled: true,
  remindTime: "09:00",
  defaultDays: 2,
  subscribe: {
    templateIds: [],
    authResult: {},
    lastAuthAt: "",
    lastAuthStatus: "unknown"
  },
  rules: {
    水果: 1,
    蔬菜: 2,
    肉类: 3,
    蛋奶: 2,
    海鲜: 1,
    饮料: 5,
    调味品: 7,
    其他: 2
  }
};
function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
const _sfc_main = {
  components: { BottomNav, IngredientIcon },
  data() {
    return {
      userId: utils_currentUser.getCurrentUserId(),
      categories: CATEGORIES,
      settings: cloneDefaults(),
      dayOptions: Array.from({ length: 31 }, (_, i) => i),
      hourOptions: Array.from({ length: 24 }, (_, i) => `${i}`.padStart(2, "0")),
      minuteOptions: ["00", "30"]
    };
  },
  computed: {
    timePickerValue() {
      var _a;
      const [hourRaw = "09", minuteRaw = "00"] = `${((_a = this.settings) == null ? void 0 : _a.remindTime) || "09:00"}`.split(":");
      const hour = `${hourRaw}`.padStart(2, "0");
      const minute = minuteRaw === "30" ? "30" : "00";
      const hourIdx = Math.max(0, this.hourOptions.indexOf(hour));
      const minuteIdx = Math.max(0, this.minuteOptions.indexOf(minute));
      return [hourIdx, minuteIdx];
    }
  },
  onLoad() {
    this.userId = utils_currentUser.getCurrentUserId();
    this.loadSettings();
  },
  methods: {
    normalizeHalfHourTime(value) {
      const text = `${value || ""}`.trim();
      const m = text.match(/^(\d{1,2}):(\d{1,2})$/);
      if (!m)
        return "09:00";
      let hour = Number(m[1]);
      let minute = Number(m[2]);
      if (!Number.isFinite(hour) || !Number.isFinite(minute))
        return "09:00";
      hour = Math.min(Math.max(Math.floor(hour), 0), 23);
      minute = minute >= 30 ? 30 : 0;
      return `${`${hour}`.padStart(2, "0")}:${minute === 30 ? "30" : "00"}`;
    },
    goBack() {
      if (getCurrentPages().length > 1) {
        common_vendor.index.navigateBack();
        return;
      }
      common_vendor.index.redirectTo({
        url: "/pages/profile/index",
        fail: () => {
          common_vendor.index.reLaunch({ url: "/pages/profile/index" });
        }
      });
    },
    clampDays(value) {
      const n = Number(value);
      if (!Number.isFinite(n))
        return 0;
      return Math.min(Math.max(Math.round(n), 0), 30);
    },
    getLimitDays(category) {
      const rule = this.settings.rules && this.settings.rules[category];
      if (rule === void 0 || rule === null)
        return this.settings.defaultDays;
      return this.clampDays(rule);
    },
    normalizeSubscribe(raw) {
      const source = raw && typeof raw === "object" ? raw : {};
      const templateIds = Array.isArray(source.templateIds) ? source.templateIds.map((x) => `${x || ""}`.trim()).filter(Boolean).slice(0, 20) : [];
      const authResultRaw = source.authResult && typeof source.authResult === "object" ? source.authResult : {};
      const authResult = {};
      Object.keys(authResultRaw).forEach((key) => {
        const k = `${key || ""}`.trim();
        if (!k)
          return;
        authResult[k] = `${authResultRaw[key] || ""}`.trim();
      });
      const lastAuthAt = `${source.lastAuthAt || ""}`.trim();
      const lastAuthStatus = `${source.lastAuthStatus || ""}`.trim() || "unknown";
      return {
        templateIds: templateIds.length ? templateIds : [...DEV_SUBSCRIBE_TEMPLATE_IDS],
        authResult,
        lastAuthAt,
        lastAuthStatus
      };
    },
    resolveTemplateIds() {
      var _a, _b;
      const saved = ((_b = (_a = this.settings) == null ? void 0 : _a.subscribe) == null ? void 0 : _b.templateIds) || [];
      const cleaned = saved.map((x) => `${x || ""}`.trim()).filter(Boolean);
      const valid = cleaned.filter((id) => !id.includes("替换") && !id.includes("YOUR_"));
      if (valid.length)
        return valid;
      return DEV_SUBSCRIBE_TEMPLATE_IDS.map((x) => `${x || ""}`.trim()).filter((id) => !!id && !id.includes("替换") && !id.includes("YOUR_"));
    },
    requestSubscribe() {
      const templateIds = this.resolveTemplateIds();
      if (!templateIds.length) {
        common_vendor.index.showToast({ title: "请先配置订阅模板ID", icon: "none" });
        return;
      }
      if (typeof common_vendor.index.requestSubscribeMessage !== "function") {
        common_vendor.index.showToast({ title: "当前环境不支持订阅授权", icon: "none" });
        return;
      }
      common_vendor.index.requestSubscribeMessage({
        tmplIds: templateIds,
        fail: () => {
          common_vendor.index.showToast({ title: "授权取消或失败，请重试", icon: "none" });
        }
      });
    },
    async loadSettings() {
      try {
        const raw = await api_modules_expiryReminder.getExpiryReminderSettings(this.userId);
        if (!raw || typeof raw !== "object") {
          this.settings = cloneDefaults();
          return;
        }
        const merged = cloneDefaults();
        merged.enabled = !!raw.enabled;
        merged.remindTime = this.normalizeHalfHourTime(`${raw.remindTime || merged.remindTime}`);
        merged.defaultDays = this.clampDays(raw.defaultDays);
        merged.rules = { ...merged.rules };
        merged.subscribe = this.normalizeSubscribe(raw == null ? void 0 : raw.subscribe);
        this.categories.forEach((cat) => {
          var _a;
          const fromRaw = (_a = raw == null ? void 0 : raw.rules) == null ? void 0 : _a[cat];
          if (fromRaw !== void 0 && fromRaw !== null) {
            merged.rules[cat] = this.clampDays(fromRaw);
          }
        });
        this.settings = merged;
      } catch (e) {
        this.settings = cloneDefaults();
        common_vendor.index.showToast({ title: "提醒设置加载失败", icon: "none" });
      }
    },
    onTimeChange(e) {
      var _a;
      const value = (_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value;
      if (Array.isArray(value)) {
        const hour = this.hourOptions[Number(value[0]) || 0] || "09";
        const minute = this.minuteOptions[Number(value[1]) || 0] || "00";
        this.settings.remindTime = `${hour}:${minute}`;
        return;
      }
      this.settings.remindTime = this.normalizeHalfHourTime(`${value || ""}`);
    },
    onRulePick(category, e) {
      var _a;
      const idx = Number((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value);
      const picked = this.dayOptions[idx];
      const next = this.clampDays(picked);
      this.settings.rules = {
        ...this.settings.rules,
        [category]: next
      };
    },
    resetDefaults() {
      this.settings = cloneDefaults();
      common_vendor.index.showToast({ title: "已恢复默认", icon: "none" });
    },
    saveSettings() {
      api_modules_expiryReminder.updateExpiryReminderSettings({
        userId: this.userId,
        enabled: this.settings.enabled,
        remindTime: this.settings.remindTime,
        defaultDays: this.settings.defaultDays,
        rules: this.settings.rules,
        subscribe: this.normalizeSubscribe(this.settings.subscribe)
      }).then((saved) => {
        if (saved && typeof saved === "object") {
          this.settings = {
            ...this.settings,
            enabled: !!saved.enabled,
            remindTime: `${saved.remindTime || this.settings.remindTime}`,
            defaultDays: this.clampDays(saved.defaultDays),
            subscribe: this.normalizeSubscribe((saved == null ? void 0 : saved.subscribe) || this.settings.subscribe),
            rules: {
              ...this.settings.rules,
              ...saved.rules && typeof saved.rules === "object" ? saved.rules : {}
            }
          };
        }
        common_vendor.index.showToast({ title: "已保存提醒设置", icon: "success" });
      }).catch(() => {
        common_vendor.index.showToast({ title: "保存失败，请重试", icon: "none" });
      });
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
    a: common_vendor.o((...args) => $options.goBack && $options.goBack(...args)),
    b: common_vendor.o((...args) => $options.requestSubscribe && $options.requestSubscribe(...args)),
    c: common_vendor.t($data.settings.remindTime),
    d: [$data.hourOptions, $data.minuteOptions],
    e: $options.timePickerValue,
    f: common_vendor.o((...args) => $options.onTimeChange && $options.onTimeChange(...args)),
    g: common_vendor.f($data.categories, (cat, k0, i0) => {
      return {
        a: "39acdab0-0-" + i0,
        b: common_vendor.p({
          name: cat,
          category: cat,
          size: 34
        }),
        c: common_vendor.t(cat),
        d: common_vendor.t($options.getLimitDays(cat)),
        e: $options.getLimitDays(cat),
        f: common_vendor.o(($event) => $options.onRulePick(cat, $event), cat),
        g: cat
      };
    }),
    h: $data.dayOptions,
    i: common_vendor.o((...args) => $options.resetDefaults && $options.resetDefaults(...args)),
    j: common_vendor.o((...args) => $options.saveSettings && $options.saveSettings(...args)),
    k: common_vendor.p({
      current: "profile"
    }),
    l: `${_ctx.safeTop + 14}px`
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-39acdab0"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/profile/expiry-reminder.js.map
