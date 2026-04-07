const STORAGE_KEY = 'shelfLifeDaysByCategory'

export const DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY = {
	水果: 5,
	蔬菜: 3,
	肉类: 2,
	蛋奶: 5,
	海鲜: 2,
	饮料: 30,
	调味品: 90,
	其他: 7
}

function normalizeDays(value, fallback) {
	const n = Math.floor(Number(value))
	if (!Number.isFinite(n) || n <= 0) return fallback
	return Math.min(n, 3650)
}

export function getShelfLifeDaysByCategory() {
	const raw = uni.getStorageSync(STORAGE_KEY)
	const out = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
	if (!raw || typeof raw !== 'object') return out
	Object.keys(out).forEach((cat) => {
		out[cat] = normalizeDays(raw[cat], out[cat])
	})
	return out
}

export function setShelfLifeDaysByCategory(value = {}) {
	const normalized = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
	Object.keys(normalized).forEach((cat) => {
		normalized[cat] = normalizeDays(value[cat], normalized[cat])
	})
	uni.setStorageSync(STORAGE_KEY, normalized)
	return normalized
}

export function getShelfLifeDays(category, map) {
	const current = map && typeof map === 'object' ? map : getShelfLifeDaysByCategory()
	const key = Object.prototype.hasOwnProperty.call(current, category) ? category : '其他'
	return normalizeDays(current[key], DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY[key])
}
