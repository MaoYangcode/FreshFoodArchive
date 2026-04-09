"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_ingredients = require("../../api/modules/ingredients.js");
const BottomNav = () => "../../components/bottom-nav.js";
const FridgeViewControls = () => "../../components/fridge-view-controls.js";
const IngredientIcon = () => "../../components/ingredient-icon.js";
const LocationIcon = () => "../../components/location-icon.js";
const PINYIN_CHAR_MAP = {
  全: "quan",
  部: "bu",
  位: "wei",
  置: "zhi",
  类: "lei",
  别: "bie",
  水: "shui",
  果: "guo",
  蔬: "shu",
  菜: "cai",
  肉: "rou",
  蛋: "dan",
  奶: "nai",
  海: "hai",
  鲜: "xian",
  饮: "yin",
  料: "liao",
  调: "tiao",
  味: "wei",
  品: "pin",
  其: "qi",
  他: "ta",
  冷: "leng",
  藏: "cang",
  冻: "dong",
  常: "chang",
  温: "wen",
  苹: "ping",
  香: "xiang",
  蕉: "jiao",
  牛: "niu",
  西: "xi",
  兰: "lan",
  花: "hua",
  椰: "ye",
  胡: "hu",
  萝: "luo",
  卜: "bu",
  鸡: "ji",
  胸: "xiong",
  黄: "huang",
  瓜: "gua",
  生: "sheng",
  蘑: "mo",
  菇: "gu",
  面: "mian",
  条: "tiao",
  洋: "yang",
  葱: "cong",
  橙: "cheng",
  子: "zi",
  猪: "zhu",
  土: "tu",
  豆: "dou",
  马: "ma",
  铃: "ling",
  薯: "shu",
  大: "da",
  米: "mi",
  饭: "fan",
  虾: "xia",
  腐: "fu",
  番: "fan",
  茄: "qie",
  红: "hong",
  柿: "shi",
  梨: "li",
  桃: "tao",
  柚: "you",
  橘: "ju",
  柑: "gan",
  葡: "pu",
  萄: "tao",
  柠: "ning",
  檬: "meng",
  青: "qing",
  白: "bai",
  黑: "hei",
  玉: "yu",
  芹: "qin",
  蒜: "suan",
  姜: "jiang",
  葵: "kui",
  南: "nan",
  笋: "sun",
  包: "bao",
  心: "xin"
};
function buildPinyinIndex(text) {
  const raw = `${text || ""}`.toLowerCase();
  let full = "";
  let initials = "";
  for (const ch of raw) {
    if (/[a-z0-9]/.test(ch)) {
      full += ch;
      initials += ch;
      continue;
    }
    const py = PINYIN_CHAR_MAP[ch];
    if (!py)
      continue;
    full += py;
    initials += py[0];
  }
  return { full, initials };
}
const _sfc_main = {
  components: { BottomNav, FridgeViewControls, IngredientIcon, LocationIcon },
  data() {
    return {
      keyword: "",
      locations: ["全部位置", "冷藏", "冷冻"],
      categories: ["全部类别", "水果", "蔬菜", "肉类", "蛋奶", "海鲜", "饮料", "调味品", "其他"],
      selectedLocation: "全部位置",
      selectedCategories: ["全部类别"],
      viewMode: "list",
      sortDirection: "asc",
      list: [],
      openSwipeId: "",
      touchStartX: 0,
      touchStartY: 0,
      touchDeltaX: 0,
      touchDeltaY: 0,
      touchHorizontalLock: null,
      mouseStartX: 0,
      mouseStartY: 0,
      mouseDownId: "",
      mouseMoveX: 0,
      mouseMoveY: 0,
      mouseDragging: false,
      preventNextClick: false,
      mousePressTimer: null,
      isDesktop: true,
      lastTouchAt: 0,
      consumeDialogVisible: false,
      consumeQty: 1,
      pendingConsumeItem: null,
      lastQtyLimitToastAt: 0,
      lastNavigateAt: 0
    };
  },
  onLoad() {
    try {
      const platform = common_vendor.index.getSystemInfoSync().platform || "";
      this.isDesktop = platform === "windows" || platform === "mac";
    } catch (e) {
      this.isDesktop = true;
    }
  },
  mounted() {
    this.bindWindowEvents();
  },
  beforeUnmount() {
    this.unbindWindowEvents();
  },
  onUnload() {
    this.unbindWindowEvents();
  },
  onShow() {
    this.refreshList();
  },
  computed: {
    categoryCounts() {
      const rawKeyword = `${this.keyword || ""}`;
      const keywordText = rawKeyword.trim().toLowerCase();
      const compactKeyword = keywordText.replace(/\s+/g, "");
      const tokens = keywordText.split(/\s+/).filter(Boolean);
      const counts = {};
      this.categories.forEach((cat) => {
        counts[cat] = 0;
      });
      let total = 0;
      this.list.forEach((item) => {
        const locationHit = this.selectedLocation === "全部位置" || item.location === this.selectedLocation;
        const keywordHit = this.matchKeyword(item, compactKeyword, tokens);
        if (!locationHit || !keywordHit)
          return;
        total += 1;
        if (counts[item.category] !== void 0) {
          counts[item.category] += 1;
        }
      });
      counts["全部类别"] = total;
      return counts;
    },
    filteredList() {
      const rawKeyword = `${this.keyword || ""}`;
      const keywordText = rawKeyword.trim().toLowerCase();
      const compactKeyword = keywordText.replace(/\s+/g, "");
      const tokens = keywordText.split(/\s+/).filter(Boolean);
      const filtered = this.list.filter((item) => {
        const locationHit = this.selectedLocation === "全部位置" || item.location === this.selectedLocation;
        const hasAll = this.selectedCategories.includes("全部类别");
        const categoryHit = hasAll || this.selectedCategories.length === 0 || this.selectedCategories.includes(item.category);
        const keywordHit = this.matchKeyword(item, compactKeyword, tokens);
        return locationHit && categoryHit && keywordHit;
      });
      return [...filtered].sort((a, b) => {
        const ta = a && a.expireDate ? new Date(a.expireDate).getTime() : Number.POSITIVE_INFINITY;
        const tb = b && b.expireDate ? new Date(b.expireDate).getTime() : Number.POSITIVE_INFINITY;
        return this.sortDirection === "asc" ? ta - tb : tb - ta;
      });
    }
  },
  methods: {
    matchKeyword(item, compactKeyword, tokens) {
      if (!compactKeyword && (!tokens || !tokens.length))
        return true;
      const haystack = `${(item == null ? void 0 : item.name) || ""} ${(item == null ? void 0 : item.category) || ""} ${(item == null ? void 0 : item.location) || ""}`.toLowerCase();
      const compactHaystack = haystack.replace(/\s+/g, "");
      const { full: pinyinFull, initials: pinyinInitials } = buildPinyinIndex(haystack);
      const fuzzyHit = !compactKeyword || compactHaystack.includes(compactKeyword) || pinyinFull.includes(compactKeyword) || pinyinInitials.includes(compactKeyword) || Array.from(compactKeyword).every((char) => compactHaystack.includes(char));
      const tokenHit = tokens.length === 0 || tokens.every(
        (token) => haystack.includes(token) || compactHaystack.includes(token) || pinyinFull.includes(token) || pinyinInitials.includes(token)
      );
      return fuzzyHit && tokenHit;
    },
    isCategorySelected(cat) {
      return this.selectedCategories.includes(cat);
    },
    toggleCategory(cat) {
      if (cat === "全部类别") {
        this.selectedCategories = ["全部类别"];
        return;
      }
      const next = this.selectedCategories.filter((x) => x !== "全部类别");
      if (next.includes(cat)) {
        this.selectedCategories = next.filter((x) => x !== cat);
        if (!this.selectedCategories.length)
          this.selectedCategories = ["全部类别"];
        return;
      }
      this.selectedCategories = [...next, cat];
    },
    bindWindowEvents() {
      if (typeof window === "undefined")
        return;
      window.addEventListener("mousemove", this.onWindowMouseMove);
      window.addEventListener("mouseup", this.onWindowMouseUp);
    },
    unbindWindowEvents() {
      if (typeof window === "undefined")
        return;
      window.removeEventListener("mousemove", this.onWindowMouseMove);
      window.removeEventListener("mouseup", this.onWindowMouseUp);
    },
    async refreshList() {
      try {
        const res = await api_modules_ingredients.getIngredientList();
        this.list = Array.isArray(res) ? res : [];
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/list.vue:333", "获取失败", e);
        common_vendor.index.showToast({
          title: "加载失败",
          icon: "none"
        });
        this.list = [];
      }
    },
    getEmoji(category) {
      const map = {
        蔬菜: "🥦",
        水果: "🥑",
        肉类: "🍗",
        蛋奶: "🧀",
        海鲜: "🦐",
        饮料: "🥛",
        调味品: "🧂",
        其他: "🍽️"
      };
      return map[category] || "🍽️";
    },
    formatQty(item) {
      const q = item && item.quantity !== void 0 ? `${item.quantity}` : "";
      const u = item && item.unit ? `${item.unit}` : "";
      return `${q}${u}` || "—";
    },
    onKeywordInput(e) {
      this.keyword = e && e.detail ? `${e.detail.value || ""}` : "";
    },
    toggleSortMode() {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    },
    toggleFridgeView() {
      this.viewMode = this.viewMode === "list" ? "tiles" : "list";
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
      if (days <= 0)
        return `过期${Math.abs(days)}天`;
      if (days <= 2)
        return `剩${days}天`;
      return "新鲜";
    },
    getDays(expireDate) {
      if (!expireDate)
        return 999;
      const now = /* @__PURE__ */ new Date();
      now.setHours(0, 0, 0, 0);
      const t = new Date(expireDate);
      t.setHours(0, 0, 0, 0);
      return Math.floor((t.getTime() - now.getTime()) / (24 * 3600 * 1e3));
    },
    barStyle(expireDate) {
      const days = this.getDays(expireDate);
      if (days <= 0)
        return { width: "92%", background: "#ce5454" };
      if (days <= 2)
        return { width: "78%", background: "#f39c34" };
      return { width: "36%", background: "#3f9f4d" };
    },
    onTouchStart(e, id) {
      this.lastTouchAt = Date.now();
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
      if (!e || !e.touches || !e.touches.length)
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
      if (!e || !e.changedTouches || !e.changedTouches.length)
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
    onMouseDown(e, id) {
      if (e.button !== 0)
        return;
      this.mouseDownId = id;
      this.mouseStartX = e.clientX;
      this.mouseStartY = e.clientY;
      this.mouseMoveX = 0;
      this.mouseMoveY = 0;
      this.mouseDragging = false;
      clearTimeout(this.mousePressTimer);
      this.mousePressTimer = setTimeout(() => {
        if (!this.mouseDragging && this.mouseDownId === id) {
          this.openSwipeId = id;
          this.preventNextClick = true;
        }
      }, 350);
      if (this.openSwipeId && this.openSwipeId !== id) {
        this.openSwipeId = "";
      }
    },
    onWindowMouseMove(e) {
      if (!this.mouseDownId)
        return;
      this.mouseMoveX = e.clientX - this.mouseStartX;
      this.mouseMoveY = e.clientY - this.mouseStartY;
      const deltaX = this.mouseMoveX;
      const deltaY = this.mouseMoveY;
      const horizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        this.mouseDragging = true;
        clearTimeout(this.mousePressTimer);
      }
      if (horizontalSwipe && deltaX < -28) {
        this.openSwipeId = this.mouseDownId;
        this.preventNextClick = true;
      } else if (horizontalSwipe && deltaX > 28) {
        this.openSwipeId = "";
        this.preventNextClick = true;
      }
    },
    onWindowMouseUp() {
      clearTimeout(this.mousePressTimer);
      if (this.mouseDragging) {
        this.preventNextClick = true;
      }
      this.mouseDownId = "";
      this.mouseDragging = false;
    },
    onWheel(e, id) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 8)
        return;
      if (e.deltaX > 0) {
        this.openSwipeId = id;
        this.preventNextClick = true;
        return;
      }
      this.openSwipeId = "";
      this.preventNextClick = true;
    },
    onDoubleClick(id) {
      this.openSwipeId = this.openSwipeId === id ? "" : id;
      this.preventNextClick = true;
    },
    onContextMenu(id) {
      this.openSwipeId = id;
      this.preventNextClick = true;
    },
    onLongPress(id) {
      this.openSwipeId = id;
      this.preventNextClick = true;
    },
    closeSwipe() {
      this.openSwipeId = "";
    },
    onRowClick(item) {
      this.goEdit(item);
    },
    goEdit(item) {
      const now = Date.now();
      if (now - this.lastNavigateAt < 350)
        return;
      const id = (item == null ? void 0 : item.id) ?? (item == null ? void 0 : item.ingredientId) ?? "";
      if (!id && id !== 0) {
        common_vendor.index.showToast({
          title: "食材ID缺失",
          icon: "none"
        });
        return;
      }
      this.lastNavigateAt = now;
      common_vendor.index.navigateTo({
        url: `/pages/fridge/edit?id=${id}`
      });
    },
    openConsumeDialog(item) {
      this.pendingConsumeItem = item;
      this.consumeQty = 1;
      this.openSwipeId = "";
      this.consumeDialogVisible = true;
    },
    closeConsumeDialog() {
      this.consumeDialogVisible = false;
      this.pendingConsumeItem = null;
      this.consumeQty = 1;
    },
    changeConsumeQty(delta) {
      var _a;
      const max = this.getMaxConsumeQty();
      const current = Number(this.consumeQty || 1);
      const next = current + delta;
      if (next < 1) {
        this.consumeQty = 1;
        return;
      }
      if (delta > 0 && current >= max) {
        const now = Date.now();
        if (now - this.lastQtyLimitToastAt > 1e3) {
          this.lastQtyLimitToastAt = now;
          common_vendor.index.showToast({
            title: `当前最多可取 ${max}${((_a = this.pendingConsumeItem) == null ? void 0 : _a.unit) || ""}`,
            icon: "none"
          });
        }
        return;
      }
      this.consumeQty = next > max ? max : next;
    },
    getMaxConsumeQty() {
      const raw = this.pendingConsumeItem ? Number(this.pendingConsumeItem.quantity) : 1;
      if (!raw || raw < 1)
        return 1;
      return Math.floor(raw);
    },
    formatConsumeName(name) {
      const text = `${name || ""}`.trim();
      if (!text)
        return "";
      const chunkSize = 5;
      const parts = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        parts.push(text.slice(i, i + chunkSize));
      }
      return parts.join("\n");
    },
    normalizeConsumeQty() {
      const max = this.getMaxConsumeQty();
      const value = Number(this.consumeQty);
      if (!value || value < 1) {
        this.consumeQty = 1;
        return;
      }
      this.consumeQty = value > max ? max : Math.floor(value);
    },
    onConsumeQtyInput(e) {
      const raw = e && e.detail ? `${e.detail.value || ""}` : `${this.consumeQty || ""}`;
      const digits = raw.replace(/[^\d]/g, "");
      if (!digits) {
        this.consumeQty = "";
        return;
      }
      this.consumeQty = `${Math.max(1, parseInt(digits, 10))}`;
    },
    async confirmConsume() {
      const item = this.pendingConsumeItem;
      const quantity = Number(this.consumeQty || 0);
      const max = this.getMaxConsumeQty();
      if (!item)
        return;
      if (!quantity || quantity <= 0) {
        common_vendor.index.showToast({
          title: "请输入正确数量",
          icon: "none"
        });
        return;
      }
      if (quantity > max) {
        this.consumeQty = max;
        common_vendor.index.showToast({
          title: `库存不足，当前最多可取 ${max}${item.unit || ""}`,
          icon: "none"
        });
        return;
      }
      try {
        await api_modules_ingredients.consumeIngredient(item.id, {
          quantity
        });
        this.openSwipeId = "";
        this.closeConsumeDialog();
        common_vendor.index.showToast({
          title: `已取出 ${quantity}${item.unit || ""}`,
          icon: "success"
        });
        this.refreshList();
      } catch (e) {
        common_vendor.index.__f__("error", "at pages/fridge/list.vue:629", "取出失败", e);
        common_vendor.index.showToast({
          title: "取出失败",
          icon: "none"
        });
      }
    }
  }
};
if (!Array) {
  const _component_LocationIcon = common_vendor.resolveComponent("LocationIcon");
  const _component_FridgeViewControls = common_vendor.resolveComponent("FridgeViewControls");
  const _component_IngredientIcon = common_vendor.resolveComponent("IngredientIcon");
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  (_component_LocationIcon + _component_FridgeViewControls + _component_IngredientIcon + _component_BottomNav)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: `${_ctx.navRightGap}px`,
    b: common_vendor.f($data.locations, (loc, k0, i0) => {
      return common_vendor.e({
        a: loc !== "全部位置"
      }, loc !== "全部位置" ? {
        b: "e946cee4-0-" + i0,
        c: common_vendor.p({
          location: loc,
          size: 18,
          color: "#8fb7e8"
        })
      } : {}, {
        d: common_vendor.t(loc),
        e: loc,
        f: $data.selectedLocation === loc ? 1 : "",
        g: common_vendor.o(($event) => $data.selectedLocation = loc, loc)
      });
    }),
    c: common_vendor.f($data.categories, (cat, k0, i0) => {
      return common_vendor.e({
        a: common_vendor.t(cat),
        b: cat !== "全部类别"
      }, cat !== "全部类别" ? {
        c: common_vendor.t($options.categoryCounts[cat] || 0)
      } : {}, {
        d: cat,
        e: $options.isCategorySelected(cat) ? 1 : "",
        f: cat === "全部类别" ? 1 : "",
        g: common_vendor.o(($event) => $options.toggleCategory(cat), cat)
      });
    }),
    d: $data.keyword,
    e: common_vendor.o((...args) => $options.onKeywordInput && $options.onKeywordInput(...args)),
    f: common_vendor.o($options.toggleFridgeView),
    g: common_vendor.o($options.toggleSortMode),
    h: common_vendor.p({
      viewMode: $data.viewMode,
      sortDirection: $data.sortDirection
    }),
    i: $options.filteredList.length === 0
  }, $options.filteredList.length === 0 ? {
    j: common_vendor.p({
      name: "冰箱",
      category: "其他",
      size: 66
    })
  } : common_vendor.e({
    k: $data.viewMode === "list"
  }, $data.viewMode === "list" ? {
    l: common_vendor.f($options.filteredList, (item, k0, i0) => {
      return {
        a: common_vendor.o(($event) => $options.openConsumeDialog(item), item.id),
        b: "e946cee4-3-" + i0,
        c: common_vendor.p({
          name: item.name,
          category: item.category,
          size: 46
        }),
        d: common_vendor.t(item.name),
        e: common_vendor.t(item.quantity),
        f: common_vendor.t(item.unit),
        g: common_vendor.t(item.category),
        h: "e946cee4-4-" + i0,
        i: common_vendor.p({
          location: item.location,
          size: 14,
          color: "#8fb7e8"
        }),
        j: common_vendor.t(item.location),
        k: common_vendor.t($options.getTagText(item.expireDate)),
        l: common_vendor.n($options.getTagClass(item.expireDate)),
        m: $data.openSwipeId === item.id ? 1 : "",
        n: common_vendor.o(($event) => $options.onTouchStart($event, item.id), item.id),
        o: common_vendor.o(($event) => $options.onTouchMove($event), item.id),
        p: common_vendor.o(($event) => $options.onTouchEnd($event, item.id), item.id),
        q: common_vendor.o(($event) => $options.onMouseDown($event, item.id), item.id),
        r: common_vendor.o(($event) => $options.onWheel($event, item.id), item.id),
        s: common_vendor.o(($event) => $options.onDoubleClick(item.id), item.id),
        t: common_vendor.o(($event) => $options.onLongPress(item.id), item.id),
        v: common_vendor.o(($event) => $options.onLongPress(item.id), item.id),
        w: common_vendor.o(($event) => $options.onContextMenu(item.id), item.id),
        x: common_vendor.o(($event) => $options.onRowClick(item), item.id),
        y: item.id
      };
    })
  } : {
    m: common_vendor.f($options.filteredList, (item, k0, i0) => {
      return {
        a: common_vendor.t($options.formatQty(item)),
        b: "e946cee4-5-" + i0,
        c: common_vendor.p({
          name: item.name,
          category: item.category,
          size: 40
        }),
        d: common_vendor.t(item.name),
        e: "e946cee4-6-" + i0,
        f: common_vendor.p({
          location: item.location,
          size: 14,
          color: "#8fb7e8"
        }),
        g: common_vendor.t(item.location),
        h: common_vendor.s($options.barStyle(item.expireDate)),
        i: `tile-${item.id}`,
        j: common_vendor.o(($event) => $options.goEdit(item), `tile-${item.id}`)
      };
    })
  }, {
    n: common_vendor.n($data.viewMode === "list" ? "card" : "tiles-wrap")
  }), {
    o: $data.consumeDialogVisible
  }, $data.consumeDialogVisible ? {
    p: common_vendor.t($options.formatConsumeName($data.pendingConsumeItem ? $data.pendingConsumeItem.name : "")),
    q: common_vendor.o(($event) => $options.changeConsumeQty(-1)),
    r: common_vendor.o([($event) => $data.consumeQty = $event.detail.value, (...args) => $options.onConsumeQtyInput && $options.onConsumeQtyInput(...args)]),
    s: common_vendor.o((...args) => $options.normalizeConsumeQty && $options.normalizeConsumeQty(...args)),
    t: $data.consumeQty,
    v: common_vendor.o(($event) => $options.changeConsumeQty(1)),
    w: common_vendor.t($data.pendingConsumeItem ? $data.pendingConsumeItem.unit : ""),
    x: common_vendor.o((...args) => $options.closeConsumeDialog && $options.closeConsumeDialog(...args)),
    y: common_vendor.o((...args) => $options.confirmConsume && $options.confirmConsume(...args)),
    z: common_vendor.o(() => {
    }),
    A: common_vendor.o((...args) => $options.closeConsumeDialog && $options.closeConsumeDialog(...args))
  } : {}, {
    B: common_vendor.p({
      current: "fridge"
    }),
    C: `${_ctx.safeTop + 14}px`,
    D: common_vendor.o((...args) => $options.closeSwipe && $options.closeSwipe(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-e946cee4"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/fridge/list.js.map
