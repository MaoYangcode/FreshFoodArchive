"use strict";
const utils_ingredientImage = require("../utils/ingredient-image.js");
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  name: "IngredientIcon",
  props: {
    name: { type: String, default: "" },
    category: { type: String, default: "" },
    size: { type: Number, default: 44 },
    imageScale: { type: Number, default: 1.52 }
  },
  computed: {
    weappColorClass() {
      return utils_ingredientImage.getIngredientWeappColorClass(this.name, this.category);
    },
    emoji() {
      return utils_ingredientImage.getCategoryEmoji(this.category);
    },
    wrapStyle() {
      const n = Math.max(18, Number(this.size) || 44);
      return { width: `${n}px`, height: `${n}px` };
    },
    iconStyle() {
      const n = Math.max(18, Number(this.size) || 44);
      return { width: `${n}px`, height: `${n}px` };
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $options.weappColorClass
  }, $options.weappColorClass ? {
    b: common_vendor.n($options.weappColorClass),
    c: common_vendor.s($options.iconStyle)
  } : {
    d: common_vendor.t($options.emoji)
  }, {
    e: common_vendor.s($options.wrapStyle)
  });
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-a40cf471"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/ingredient-icon.js.map
