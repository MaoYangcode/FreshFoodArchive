"use strict";
const common_vendor = require("../common/vendor.js");
const STORAGE_KEY = "fresh-food-archive-state-v1";
const defaultState = {
  ingredients: [
    {
      id: "ing-1",
      name: "西红柿",
      category: "蔬菜",
      quantity: 2,
      unit: "个",
      location: "冷藏",
      expireDate: "2026-03-12",
      createdAt: "2026-03-08 09:00:00"
    },
    {
      id: "ing-2",
      name: "鸡蛋",
      category: "蛋奶",
      quantity: 10,
      unit: "个",
      location: "冷藏",
      expireDate: "2026-03-15",
      createdAt: "2026-03-08 09:05:00"
    },
    {
      id: "ing-3",
      name: "牛肉",
      category: "肉类",
      quantity: 300,
      unit: "g",
      location: "冷冻",
      expireDate: "2026-04-01",
      createdAt: "2026-03-08 09:08:00"
    }
  ],
  takeoutRecords: [],
  favoriteRecipes: [],
  basketItems: []
};
let state = JSON.parse(JSON.stringify(defaultState));
let initialized = false;
function nowString() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => `${n}`.padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}
function normalizeFavoriteRecipe(item) {
  const normalized = item && typeof item === "object" ? item : {};
  return {
    id: normalized.id || `fav-${Date.now()}`,
    name: normalized.name || "",
    available: Array.isArray(normalized.available) ? normalized.available : [],
    missing: Array.isArray(normalized.missing) ? normalized.missing : [],
    duration: Number(normalized.duration || 20),
    difficulty: normalized.difficulty || "简单",
    createdAt: normalized.createdAt || normalized.favoritedAt || nowString(),
    favoritedAt: normalized.favoritedAt || normalized.createdAt || nowString(),
    completedCount: Math.max(Number(normalized.completedCount || 0), 0),
    lastCompletedAt: normalized.lastCompletedAt || "",
    raw: normalized.raw && typeof normalized.raw === "object" ? normalized.raw : null
  };
}
function normalizeBasketName(name) {
  return `${name || ""}`.trim().replace(/\s+/g, "").toLowerCase();
}
const BASKET_CATEGORY_KEYWORDS = {
  调味品: [
    "盐",
    "糖",
    "白糖",
    "红糖",
    "冰糖",
    "酱油",
    "生抽",
    "老抽",
    "蚝油",
    "料酒",
    "醋",
    "陈醋",
    "香醋",
    "米醋",
    "胡椒",
    "胡椒粉",
    "花椒",
    "辣椒",
    "辣椒油",
    "豆瓣酱",
    "番茄酱",
    "沙拉酱",
    "芝麻酱",
    "橄榄油",
    "菜籽油",
    "花生油",
    "芝麻油",
    "香油",
    "食用油",
    "鸡精",
    "味精",
    "淀粉",
    "蜂蜜",
    "孜然",
    "十三香",
    "咖喱"
  ],
  蛋奶: ["鸡蛋", "鸭蛋", "鹅蛋", "牛奶", "酸奶", "奶酪", "黄油", "奶油", "芝士"],
  肉类: ["牛肉", "猪肉", "鸡肉", "鸭肉", "羊肉", "里脊", "排骨", "肉末", "腊肠", "火腿", "培根"],
  海鲜: ["虾", "鱼", "蟹", "贝", "蚝", "鱿鱼", "海参", "三文鱼", "金枪鱼", "带鱼", "鳕鱼"],
  水果: ["苹果", "香蕉", "橙", "橘", "柠檬", "梨", "桃", "西瓜", "葡萄", "芒果", "草莓", "蓝莓"],
  饮料: ["可乐", "雪碧", "果汁", "汽水", "苏打水", "矿泉水", "咖啡", "茶", "椰汁", "豆浆"]
};
function inferBasketCategoryByName(name) {
  const text = `${name || ""}`.trim();
  if (!text)
    return "其他";
  for (const category of Object.keys(BASKET_CATEGORY_KEYWORDS)) {
    const keywords = BASKET_CATEGORY_KEYWORDS[category];
    if (keywords.some((kw) => text.includes(kw)))
      return category;
  }
  return "其他";
}
function pickBasketCategory(rawCategory, name) {
  const normalized = `${rawCategory || ""}`.trim();
  if (normalized && normalized !== "其他")
    return normalized;
  return inferBasketCategoryByName(name);
}
function normalizeBasketItem(item) {
  const normalized = item && typeof item === "object" ? item : {};
  const quantityRaw = Number(normalized.quantity);
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
  const name = `${normalized.name || ""}`.trim();
  return {
    id: normalized.id || `basket-${Date.now()}`,
    name,
    quantity,
    unit: `${normalized.unit || "份"}`.trim() || "份",
    category: pickBasketCategory(normalized.category, name),
    status: normalized.status === "done" ? "done" : "todo",
    sourceRecipeName: `${normalized.sourceRecipeName || ""}`.trim(),
    note: `${normalized.note || ""}`.trim(),
    createdAt: normalized.createdAt || nowString(),
    updatedAt: normalized.updatedAt || nowString()
  };
}
function saveState() {
  common_vendor.index.setStorageSync(STORAGE_KEY, state);
}
function loadState() {
  try {
    const cached = common_vendor.index.getStorageSync(STORAGE_KEY);
    if (cached && typeof cached === "object") {
      state = {
        ingredients: Array.isArray(cached.ingredients) ? cached.ingredients : [],
        takeoutRecords: Array.isArray(cached.takeoutRecords) ? cached.takeoutRecords : [],
        favoriteRecipes: Array.isArray(cached.favoriteRecipes) ? cached.favoriteRecipes.map((item) => normalizeFavoriteRecipe(item)) : [],
        basketItems: Array.isArray(cached.basketItems) ? cached.basketItems.map((item) => normalizeBasketItem(item)) : []
      };
      return;
    }
  } catch (e) {
    common_vendor.index.__f__("warn", "at store/app-store.js:147", "load storage failed", e);
  }
  state = JSON.parse(JSON.stringify(defaultState));
  saveState();
}
function initStore() {
  if (initialized)
    return;
  loadState();
  initialized = true;
}
function addFavoriteRecipe(recipe) {
  initStore();
  const exists = state.favoriteRecipes.some((item) => item.name === recipe.name);
  if (exists)
    return false;
  state.favoriteRecipes.unshift(
    normalizeFavoriteRecipe({
      id: `fav-${Date.now()}`,
      name: recipe.name,
      available: recipe.available || [],
      missing: recipe.missing || [],
      duration: recipe.duration || 20,
      difficulty: recipe.difficulty || "简单",
      createdAt: nowString(),
      favoritedAt: nowString(),
      completedCount: 0,
      lastCompletedAt: "",
      raw: recipe.raw || null
    })
  );
  saveState();
  return true;
}
function getFavoriteRecipes() {
  initStore();
  return [...state.favoriteRecipes];
}
function upsertBasketItems(items, sourceRecipeName = "") {
  initStore();
  if (!Array.isArray(items) || !items.length)
    return { added: 0, merged: 0 };
  let added = 0;
  let merged = 0;
  const now = nowString();
  for (const raw of items) {
    const item = normalizeBasketItem({
      ...raw,
      sourceRecipeName: sourceRecipeName || (raw == null ? void 0 : raw.sourceRecipeName) || "",
      updatedAt: now
    });
    if (!item.name)
      continue;
    const key = normalizeBasketName(item.name);
    const idx = state.basketItems.findIndex((x) => normalizeBasketName(x.name) === key && x.status !== "done");
    if (idx === -1) {
      state.basketItems.unshift({
        ...item,
        id: `basket-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
        createdAt: now,
        updatedAt: now
      });
      added += 1;
      continue;
    }
    const current = state.basketItems[idx];
    state.basketItems[idx] = normalizeBasketItem({
      ...current,
      quantity: Number(current.quantity || 0) + Number(item.quantity || 0),
      unit: current.unit || item.unit,
      category: pickBasketCategory(current.category || item.category, current.name || item.name),
      sourceRecipeName: current.sourceRecipeName || item.sourceRecipeName,
      updatedAt: now
    });
    merged += 1;
  }
  saveState();
  return { added, merged };
}
function getFavoriteRecipeByName(name) {
  initStore();
  return state.favoriteRecipes.find((item) => item.name === name) || null;
}
function markFavoriteRecipeCompleted(name) {
  initStore();
  const idx = state.favoriteRecipes.findIndex((item) => item.name === name);
  if (idx === -1)
    return null;
  const next = {
    ...state.favoriteRecipes[idx],
    completedCount: Math.max(Number(state.favoriteRecipes[idx].completedCount || 0), 0) + 1,
    lastCompletedAt: nowString()
  };
  state.favoriteRecipes[idx] = normalizeFavoriteRecipe(next);
  saveState();
  return state.favoriteRecipes[idx];
}
exports.addFavoriteRecipe = addFavoriteRecipe;
exports.getFavoriteRecipeByName = getFavoriteRecipeByName;
exports.getFavoriteRecipes = getFavoriteRecipes;
exports.markFavoriteRecipeCompleted = markFavoriteRecipeCompleted;
exports.upsertBasketItems = upsertBasketItems;
//# sourceMappingURL=../../.sourcemap/mp-weixin/store/app-store.js.map
