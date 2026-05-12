"use strict";
const common_vendor = require("../common/vendor.js");
const utils_ingredientImage = require("../utils/ingredient-image.js");
const DEFAULT_ICON_BASE_URL = "https://nnvicode.com/ingredient-svgs";
function resolveIconBaseUrl() {
  try {
    const runtime = `${common_vendor.index.getStorageSync("ffaIngredientIconBaseUrl") || ""}`.trim();
    if (runtime)
      return runtime.replace(/\/+$/, "");
  } catch (_) {
  }
  return DEFAULT_ICON_BASE_URL;
}
const _sfc_main = {
  name: "IngredientIcon",
  props: {
    name: { type: String, default: "" },
    category: { type: String, default: "" },
    size: { type: Number, default: 44 },
    imageScale: { type: Number, default: 1.52 }
  },
  data() {
    return {
      iconLoadFailed: false
    };
  },
  watch: {
    name() {
      this.iconLoadFailed = false;
    },
    category() {
      this.iconLoadFailed = false;
    }
  },
  computed: {
    weappColorClass() {
      return utils_ingredientImage.getIngredientWeappColorClass(this.name, this.category);
    },
    iconUrl() {
      if (this.iconLoadFailed)
        return "";
      const cls = `${this.weappColorClass || ""}`.trim();
      if (!cls)
        return "";
      const file = cls.replace(/^t-icon-/, "");
      if (!file)
        return "";
      return `${resolveIconBaseUrl()}/${encodeURIComponent(file)}.svg`;
    },
    fallbackText() {
      const text = `${this.name || this.category || ""}`.trim();
      return text ? text.slice(0, 1) : "食";
    },
    wrapStyle() {
      const n = Math.max(18, Number(this.size) || 44);
      return { width: `${n}px`, height: `${n}px` };
    },
    iconStyle() {
      const n = Math.max(18, Number(this.size) || 44);
      return { width: `${n}px`, height: `${n}px` };
    }
  },
  methods: {
    onIconLoadError() {
      this.iconLoadFailed = true;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $options.iconUrl
  }, $options.iconUrl ? {
    b: $options.iconUrl,
    c: common_vendor.s($options.iconStyle),
    d: common_vendor.o((...args) => $options.onIconLoadError && $options.onIconLoadError(...args))
  } : {
    e: common_vendor.t($options.fallbackText)
  }, {
    f: common_vendor.s($options.wrapStyle)
  });
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-a40cf471"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/ingredient-icon.js.map
