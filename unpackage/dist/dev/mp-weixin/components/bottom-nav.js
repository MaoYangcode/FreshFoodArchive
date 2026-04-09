"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = {
  props: {
    current: {
      type: String,
      default: "home"
    }
  },
  methods: {
    go(url) {
      const currentRoute = `/${getCurrentPages().slice(-1)[0].route}`;
      if (currentRoute === url)
        return;
      common_vendor.index.reLaunch({ url });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: $props.current === "home" ? 1 : "",
    b: common_vendor.o(($event) => $options.go("/pages/home/index")),
    c: $props.current === "fridge" ? 1 : "",
    d: common_vendor.o(($event) => $options.go("/pages/fridge/list")),
    e: $props.current === "add" ? 1 : "",
    f: common_vendor.o(($event) => $options.go("/pages/fridge/add")),
    g: $props.current === "recipe" ? 1 : "",
    h: common_vendor.o(($event) => $options.go("/pages/recipe/generate")),
    i: $props.current === "profile" ? 1 : "",
    j: common_vendor.o(($event) => $options.go("/pages/profile/index"))
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-44b55bac"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/bottom-nav.js.map
