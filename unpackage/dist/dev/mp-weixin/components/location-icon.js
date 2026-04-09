"use strict";
const common_vendor = require("../common/vendor.js");
function kindFromLocation(loc) {
  const s = `${loc || ""}`.trim();
  if (s.includes("冷冻"))
    return "frozen";
  if (s.includes("冷藏"))
    return "cold";
  return "";
}
const _sfc_main = {
  name: "LocationIcon",
  props: {
    location: { type: String, default: "" },
    size: { type: Number, default: 18 },
    color: { type: String, default: "#8fb7e8" }
  },
  computed: {
    iconChar() {
      const kind = kindFromLocation(this.location);
      if (kind === "frozen")
        return "";
      if (kind === "cold")
        return "";
      return "•";
    },
    wrapStyle() {
      const n = Math.max(12, Number(this.size) || 18);
      return { width: `${n}px`, height: `${n}px` };
    },
    iconStyle() {
      const n = Math.max(12, Number(this.size) || 18);
      return { fontSize: `${n}px`, lineHeight: "1", color: this.color };
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.t($options.iconChar),
    b: common_vendor.s($options.iconStyle),
    c: common_vendor.s($options.wrapStyle)
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-3c694d2b"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/location-icon.js.map
