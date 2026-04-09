"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  name: "FridgeViewControls",
  props: {
    viewMode: { type: String, default: "list" },
    sortDirection: { type: String, default: "asc" }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $props.viewMode === "list"
  }, $props.viewMode === "list" ? {} : {}, {
    b: common_vendor.o(($event) => _ctx.$emit("toggle-view")),
    c: $props.sortDirection === "asc" ? 1 : "",
    d: $props.sortDirection === "desc" ? 1 : "",
    e: common_vendor.o(($event) => _ctx.$emit("toggle-sort"))
  });
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-80d21031"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/fridge-view-controls.js.map
