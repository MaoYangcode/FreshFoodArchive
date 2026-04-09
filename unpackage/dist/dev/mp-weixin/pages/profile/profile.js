"use strict";
const common_vendor = require("../../common/vendor.js");
const api_modules_profile = require("../../api/modules/profile.js");
const utils_currentUser = require("../../utils/current-user.js");
const BottomNav = () => "../../components/bottom-nav.js";
const DEFAULT_FORM = {
  name: "微信用户",
  avatar: "",
  householdSize: 2,
  dietPreferences: [],
  avoidances: [],
  cookware: [],
  note: ""
};
function cloneDefaultForm() {
  return JSON.parse(JSON.stringify(DEFAULT_FORM));
}
const _sfc_main = {
  components: { BottomNav },
  data() {
    return {
      userId: utils_currentUser.getCurrentUserId(),
      householdOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      dietOptions: ["清淡", "低脂", "高蛋白", "少糖", "少盐", "增肌"],
      avoidanceOptions: ["海鲜", "花生", "乳糖", "辛辣", "香菜", "葱姜蒜"],
      cookwareOptions: ["空气炸锅", "电饭煲", "烤箱", "炒锅", "蒸锅", "微波炉"],
      form: cloneDefaultForm(),
      avatarPreview: "",
      avatarDataForSave: ""
    };
  },
  computed: {
    avatarText() {
      const text = `${this.form.name || ""}`.trim();
      return text ? text.slice(0, 1) : "我";
    },
    avatarSrc() {
      const preview = `${this.avatarPreview || ""}`.trim();
      if (preview)
        return preview;
      return `${this.form.avatar || ""}`.trim();
    }
  },
  onLoad() {
    this.userId = utils_currentUser.getCurrentUserId();
    this.loadProfile();
  },
  methods: {
    goBack() {
      common_vendor.index.switchTab({ url: "/pages/profile/index" });
    },
    normalizeArray(value) {
      return Array.isArray(value) ? value.map((x) => `${x || ""}`.trim()).filter(Boolean) : [];
    },
    parseCookware(text) {
      return `${text || ""}`.split(/[、,，\s]+/).map((x) => `${x || ""}`.trim()).filter(Boolean);
    },
    async loadProfile() {
      try {
        const res = await api_modules_profile.getProfile(this.userId);
        if (!res || typeof res !== "object") {
          this.form = cloneDefaultForm();
          return;
        }
        this.form = {
          name: `${res.name || DEFAULT_FORM.name}`.trim() || DEFAULT_FORM.name,
          avatar: `${res.avatar || ""}`.trim(),
          householdSize: Number(res.householdSize || DEFAULT_FORM.householdSize),
          dietPreferences: this.normalizeArray(res.dietPreferences),
          avoidances: this.normalizeArray(res.avoidances),
          cookware: this.parseCookware(res.note),
          note: `${res.note || ""}`.trim()
        };
        this.avatarPreview = `${this.form.avatar || ""}`.trim();
        this.avatarDataForSave = "";
      } catch (e) {
        this.form = cloneDefaultForm();
        this.avatarPreview = "";
        this.avatarDataForSave = "";
        common_vendor.index.showToast({ title: "资料加载失败", icon: "none" });
      }
    },
    onHouseholdChange(e) {
      var _a;
      const idx = Number((_a = e == null ? void 0 : e.detail) == null ? void 0 : _a.value);
      const picked = this.householdOptions[idx];
      this.form.householdSize = Number(picked || DEFAULT_FORM.householdSize);
    },
    readAsDataUrl(path) {
      return new Promise((resolve, reject) => {
        var _a;
        const fs = common_vendor.index.getFileSystemManager && common_vendor.index.getFileSystemManager();
        if (!fs || !fs.readFile) {
          reject(new Error("readFile not available"));
          return;
        }
        const ext = ((_a = `${path}`.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
        let mime = "image/jpeg";
        if (ext === "png")
          mime = "image/png";
        if (ext === "webp")
          mime = "image/webp";
        if (ext === "gif")
          mime = "image/gif";
        fs.readFile({
          filePath: path,
          encoding: "base64",
          success: (res) => {
            resolve(`data:${mime};base64,${res.data || ""}`);
          },
          fail: (e) => reject(e)
        });
      });
    },
    compressAvatar(path) {
      return new Promise((resolve) => {
        if (!path || typeof common_vendor.index.compressImage !== "function") {
          resolve(path);
          return;
        }
        common_vendor.index.compressImage({
          src: path,
          quality: 50,
          compressedWidth: 320,
          compressedHeight: 320,
          success: (res) => {
            resolve((res == null ? void 0 : res.tempFilePath) || path);
          },
          fail: () => {
            resolve(path);
          }
        });
      });
    },
    pickAvatar() {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: async (res) => {
          var _a;
          const path = (_a = res == null ? void 0 : res.tempFilePaths) == null ? void 0 : _a[0];
          if (!path)
            return;
          this.avatarPreview = path;
          this.avatarDataForSave = "";
          try {
            const compressedPath = await this.compressAvatar(path);
            const dataUrl = await this.readAsDataUrl(compressedPath || path);
            const normalized = `${dataUrl || ""}`.trim();
            if (!normalized.startsWith("data:image/")) {
              throw new Error("invalid avatar data");
            }
            this.form.avatar = normalized;
            this.avatarDataForSave = normalized;
          } catch (e) {
            common_vendor.index.showToast({ title: "已选头像，保存时将再次处理", icon: "none" });
          }
        }
      });
    },
    async resolveAvatarForSave() {
      const direct = `${this.avatarDataForSave || this.form.avatar || ""}`.trim();
      if (direct.startsWith("data:image/"))
        return direct;
      const preview = `${this.avatarPreview || ""}`.trim();
      if (!preview)
        return "";
      try {
        const dataUrl = await this.readAsDataUrl(preview);
        const normalized = `${dataUrl || ""}`.trim();
        if (normalized.startsWith("data:image/"))
          return normalized;
      } catch (e) {
      }
      return "";
    },
    toggleListValue(field, value) {
      const current = Array.isArray(this.form[field]) ? this.form[field] : [];
      if (current.includes(value)) {
        this.form[field] = current.filter((x) => x !== value);
        return;
      }
      this.form[field] = [...current, value];
    },
    resetDefaults() {
      this.form = cloneDefaultForm();
      this.avatarPreview = "";
      this.avatarDataForSave = "";
      common_vendor.index.showToast({ title: "已恢复默认", icon: "none" });
    },
    async saveProfile() {
      const avatarToSave = await this.resolveAvatarForSave();
      const currentSavedAvatar = `${this.form.avatar || ""}`.trim();
      const safeAvatar = avatarToSave || (currentSavedAvatar.startsWith("data:image/") ? currentSavedAvatar : "");
      const payload = {
        userId: this.userId,
        name: `${this.form.name || ""}`.trim() || DEFAULT_FORM.name,
        avatar: safeAvatar,
        householdSize: Number(this.form.householdSize || DEFAULT_FORM.householdSize),
        dietPreferences: this.normalizeArray(this.form.dietPreferences),
        avoidances: this.normalizeArray(this.form.avoidances),
        note: this.normalizeArray(this.form.cookware).join("、")
      };
      try {
        const saved = await api_modules_profile.updateProfile(payload);
        this.form = {
          name: `${(saved == null ? void 0 : saved.name) || payload.name}`.trim() || DEFAULT_FORM.name,
          avatar: `${(saved == null ? void 0 : saved.avatar) || payload.avatar || ""}`.trim(),
          householdSize: Number((saved == null ? void 0 : saved.householdSize) || payload.householdSize),
          dietPreferences: this.normalizeArray((saved == null ? void 0 : saved.dietPreferences) || payload.dietPreferences),
          avoidances: this.normalizeArray((saved == null ? void 0 : saved.avoidances) || payload.avoidances),
          cookware: this.parseCookware((saved == null ? void 0 : saved.note) || payload.note),
          note: `${(saved == null ? void 0 : saved.note) || payload.note}`.trim()
        };
        this.avatarPreview = `${this.form.avatar || ""}`.trim();
        this.avatarDataForSave = `${this.form.avatar || ""}`.trim();
        common_vendor.index.showToast({ title: "资料已更新", icon: "success" });
      } catch (e) {
        common_vendor.index.showToast({ title: "保存失败，请重试", icon: "none" });
      }
    }
  }
};
if (!Array) {
  const _component_BottomNav = common_vendor.resolveComponent("BottomNav");
  _component_BottomNav();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.goBack && $options.goBack(...args)),
    b: $options.avatarSrc
  }, $options.avatarSrc ? {
    c: $options.avatarSrc
  } : {}, {
    d: common_vendor.o((...args) => $options.pickAvatar && $options.pickAvatar(...args)),
    e: $data.form.name,
    f: common_vendor.o(($event) => $data.form.name = $event.detail.value),
    g: common_vendor.t($data.form.householdSize),
    h: $data.householdOptions,
    i: common_vendor.o((...args) => $options.onHouseholdChange && $options.onHouseholdChange(...args)),
    j: common_vendor.f($data.dietOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item),
        b: item,
        c: $data.form.dietPreferences.includes(item) ? 1 : "",
        d: common_vendor.o(($event) => $options.toggleListValue("dietPreferences", item), item)
      };
    }),
    k: common_vendor.f($data.avoidanceOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item),
        b: item,
        c: $data.form.avoidances.includes(item) ? 1 : "",
        d: common_vendor.o(($event) => $options.toggleListValue("avoidances", item), item)
      };
    }),
    l: common_vendor.f($data.cookwareOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item),
        b: item,
        c: $data.form.cookware.includes(item) ? 1 : "",
        d: common_vendor.o(($event) => $options.toggleListValue("cookware", item), item)
      };
    }),
    m: common_vendor.o((...args) => $options.resetDefaults && $options.resetDefaults(...args)),
    n: common_vendor.o((...args) => $options.saveProfile && $options.saveProfile(...args)),
    o: common_vendor.p({
      current: "profile"
    }),
    p: `${_ctx.safeTop + 14}px`
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-dd383ca2"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/profile/profile.js.map
