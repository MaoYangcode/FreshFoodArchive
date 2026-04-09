"use strict";
const DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY = {
  水果: 5,
  蔬菜: 3,
  肉类: 2,
  蛋奶: 5,
  海鲜: 2,
  饮料: 30,
  调味品: 90,
  其他: 7
};
function normalizeDays(value, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0)
    return fallback;
  return Math.min(n, 3650);
}
function normalizeShelfLifeDaysByCategory(value = {}) {
  const normalized = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY };
  Object.keys(normalized).forEach((cat) => {
    normalized[cat] = normalizeDays(value[cat], normalized[cat]);
  });
  return normalized;
}
function getShelfLifeDays(category, map) {
  const current = map && typeof map === "object" ? normalizeShelfLifeDaysByCategory(map) : { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY };
  const key = Object.prototype.hasOwnProperty.call(current, category) ? category : "其他";
  return normalizeDays(current[key], DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY[key]);
}
exports.DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY = DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY;
exports.getShelfLifeDays = getShelfLifeDays;
exports.normalizeShelfLifeDaysByCategory = normalizeShelfLifeDaysByCategory;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/shelf-life.js.map
