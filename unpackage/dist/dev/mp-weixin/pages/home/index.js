"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const BottomNav = () => "../../components/bottom-nav.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const HOME_INGREDIENT_CACHE_KEY = "FFA_HOME_INGREDIENTS_CACHE";
const _sfc_main = {
  components: { BottomNav, IngredientIcon },
  data() {
    return {
      safeTop: 20,
      isLoading: true,
      stats: {
        total: 0,
        fresh: 0,
        expiring: 0
      },
      latestIngredients: [],
      tip: {
        title: "今日饮食建议",
        text: "优先消耗冷藏区食材，午晚餐按“蔬菜 + 蛋白 + 粗粮”搭配；少盐少油，饮水不少于 1500ml。",
        tags: ["高纤维", "低盐", "优先临期"]
      }
    };
  },
  onLoad() {
    this.ensureShareMenu();
    try {
      const info = common_vendor.index.getSystemInfoSync();
      const top = Number((info == null ? void 0 : info.statusBarHeight) || 0);
      if (Number.isFinite(top) && top > 0)
        this.safeTop = top;
    } catch (e) {
    }
    this.hydrateFromCache();
  },
  onShow() {
    this.ensureShareMenu();
    this.refreshData();
  },
  onShareAppMessage() {
    var _a, _b;
    const total = Number(((_a = this.stats) == null ? void 0 : _a.total) || 0);
    const expiring = Number(((_b = this.stats) == null ? void 0 : _b.expiring) || 0);
    const title = total > 0 ? `我的冰箱有 ${total} 项食材${expiring > 0 ? `，其中 ${expiring} 项临期` : ""}，一起管理更省心` : "我在鲜食档案管理冰箱食材，推荐你也试试";
    return {
      title,
      path: "/pages/home/index"
    };
  },
  onShareTimeline() {
    return {
      title: "鲜食档案 | 冰箱食材管理与临期提醒"
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
    hydrateFromCache() {
      try {
        const cached = common_vendor.index.getStorageSync(HOME_INGREDIENT_CACHE_KEY);
        const list = Array.isArray(cached) ? cached : [];
        if (!list.length)
          return;
        this.applyList(list);
        this.isLoading = false;
      } catch (_) {
      }
    },
    persistCache(list) {
      try {
        common_vendor.index.setStorageSync(HOME_INGREDIENT_CACHE_KEY, Array.isArray(list) ? list : []);
      } catch (_) {
      }
    },
    extractList(res) {
      var _a;
      if (Array.isArray(res))
        return res;
      if (Array.isArray(res == null ? void 0 : res.data))
        return res.data;
      if (Array.isArray((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.data))
        return res.data.data;
      return [];
    },
    applyList(list) {
      const safeList = Array.isArray(list) ? list : [];
      const total = safeList.length;
      const now = /* @__PURE__ */ new Date();
      now.setHours(0, 0, 0, 0);
      const threeDaysMs = 3 * 24 * 60 * 60 * 1e3;
      const expiring = safeList.filter((item) => {
        const t = new Date(item.expireDate).getTime();
        if (!Number.isFinite(t))
          return false;
        return t - now.getTime() <= threeDaysMs;
      }).length;
      const fresh = Math.max(total - expiring, 0);
      this.stats = { total, fresh, expiring };
      const toTs = (item) => {
        const t = new Date(item.expireDate).getTime();
        return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
      };
      this.latestIngredients = [...safeList].sort((a, b) => toTs(a) - toTs(b)).slice(0, 3);
      this.tip = this.buildSmartTip(safeList);
    },
    async refreshData() {
      try {
        const res = await api_modules_ingredients.getIngredientList();
        const list = this.extractList(res);
        this.applyList(list);
        this.persistCache(list);
      } catch (e) {
        if (!this.latestIngredients.length) {
          common_vendor.index.showToast({ title: "首页加载失败", icon: "none" });
        }
      } finally {
        this.isLoading = false;
      }
    },
    buildSmartTip(list) {
      const items = Array.isArray(list) ? list : [];
      if (!items.length) {
        return {
          title: "先补一点常用食材",
          text: "当前库存较少，建议先补充 2-3 种基础食材（如鸡蛋、番茄、绿叶菜），更容易快速做出一餐。",
          tags: ["先补库存", "基础食材", "省时做饭"]
        };
      }
      const expired = items.filter((x) => this.getDays(x.expireDate) < 0);
      if (expired.length) {
        const names = [...new Set(expired.map((x) => x.name).filter(Boolean))].slice(0, 3).join("、");
        return {
          title: "先检查过期食材",
          text: `发现 ${expired.length} 项可能已过期${names ? `（${names}）` : ""}，建议先核对状态并优先清理，避免误食。`,
          tags: ["食品安全", "先清理", "避免浪费"]
        };
      }
      const expiringSoon = items.filter((x) => {
        const d = this.getDays(x.expireDate);
        return d >= 0 && d <= 2;
      });
      if (expiringSoon.length) {
        const names = [...new Set(expiringSoon.map((x) => x.name).filter(Boolean))].slice(0, 3).join("、");
        return {
          title: "优先消耗临期食材",
          text: `${expiringSoon.length} 项食材 2 天内到期${names ? `（${names}）` : ""}，建议今晚优先使用，减少损耗。`,
          tags: ["优先临期", "今晚先做", "减少浪费"]
        };
      }
      const countByCategory = items.reduce((acc, x) => {
        const key = `${(x == null ? void 0 : x.category) || "其他"}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const vegCount = (countByCategory["蔬菜"] || 0) + (countByCategory["水果"] || 0);
      const proteinCount = (countByCategory["肉类"] || 0) + (countByCategory["蛋奶"] || 0) + (countByCategory["海鲜"] || 0);
      if (vegCount === 0) {
        return {
          title: "建议补充蔬果",
          text: "当前库存缺少蔬果，建议下次采购补 1-2 种绿叶菜或高纤维蔬果，搭配会更均衡。",
          tags: ["补蔬果", "高纤维", "均衡饮食"]
        };
      }
      if (proteinCount === 0) {
        return {
          title: "建议补充蛋白来源",
          text: "当前库存蛋白类偏少，可补充鸡蛋、豆制品或瘦肉，日常做菜更容易搭配。",
          tags: ["补蛋白", "营养均衡", "更好搭配"]
        };
      }
      return {
        title: "库存状态良好",
        text: "当前食材结构较均衡，继续按“蔬菜 + 蛋白 + 主食”搭配即可，做饭效率和营养都会更稳定。",
        tags: ["结构均衡", "按需消耗", "保持节奏"]
      };
    },
    getTagClass(expireDate) {
      const days = this.getDays(expireDate);
      if (days <= 0)
        return "bad";
      if (days <= 2)
        return "warn";
      return "ok";
    },
    getTagText(expireDate) {
      const days = this.getDays(expireDate);
      if (days < 0)
        return `过期${Math.abs(days)}天`;
      if (days === 0)
        return "今天过期";
      if (days <= 2)
        return `剩${days}天`;
      return "新鲜";
    },
    getDays(expireDate) {
      const now = /* @__PURE__ */ new Date();
      now.setHours(0, 0, 0, 0);
      const t = new Date(expireDate);
      t.setHours(0, 0, 0, 0);
      return Math.floor((t.getTime() - now.getTime()) / (24 * 3600 * 1e3));
    },
    goFridge() {
      common_vendor.index.redirectTo({
        url: "/pages/fridge/list",
        fail: () => {
          common_vendor.index.reLaunch({ url: "/pages/fridge/list" });
        }
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
  return common_vendor.e({
    a: `${_ctx.navRightGap}px`,
    b: common_vendor.t($data.stats.total),
    c: common_vendor.t($data.stats.fresh),
    d: common_vendor.t($data.stats.expiring),
    e: common_vendor.o((...args) => $options.goFridge && $options.goFridge(...args)),
    f: $data.isLoading
  }, $data.isLoading ? {
    g: common_vendor.p({
      name: "冰箱",
      category: "其他",
      size: 34
    })
  } : $data.latestIngredients.length === 0 ? {
    i: common_vendor.p({
      name: "冰箱",
      category: "其他",
      size: 34
    })
  } : {}, {
    h: $data.latestIngredients.length === 0,
    j: common_vendor.f($data.latestIngredients, (item, k0, i0) => {
      return {
        a: "4978fed5-2-" + i0,
        b: common_vendor.p({
          name: item.name,
          category: item.category,
          size: 40
        }),
        c: common_vendor.t(item.name),
        d: common_vendor.t(item.quantity),
        e: common_vendor.t(item.unit),
        f: common_vendor.t(item.category),
        g: common_vendor.t(item.location),
        h: common_vendor.t($options.getTagText(item.expireDate)),
        i: common_vendor.n($options.getTagClass(item.expireDate)),
        j: item.id
      };
    }),
    k: common_vendor.t($data.tip.title),
    l: common_vendor.t($data.tip.text),
    m: common_vendor.f($data.tip.tags, (tag, k0, i0) => {
      return {
        a: common_vendor.t(tag),
        b: tag
      };
    }),
    n: common_vendor.p({
      current: "home"
    }),
    o: `${$data.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-4978fed5"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/home/index.js.map
