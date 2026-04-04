const STORAGE_KEY = 'FRIDGE_CUSTOM_CATEGORIES'

export const DEFAULT_INGREDIENT_CATEGORIES = ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他']

function normalizeCategory(name) {
	return `${name || ''}`.trim()
}

function uniq(arr) {
	return Array.from(new Set(arr))
}

export function getCustomCategories() {
	try {
		const raw = uni.getStorageSync(STORAGE_KEY)
		if (!Array.isArray(raw)) return []
		return uniq(
			raw
				.map(normalizeCategory)
				.filter((x) => x && !DEFAULT_INGREDIENT_CATEGORIES.includes(x) && x !== '自定义' && x !== '全部类别')
		)
	} catch (e) {
		return []
	}
}

export function setCustomCategories(list) {
	const cleaned = uniq(
		(Array.isArray(list) ? list : [])
			.map(normalizeCategory)
			.filter((x) => x && !DEFAULT_INGREDIENT_CATEGORIES.includes(x) && x !== '自定义' && x !== '全部类别')
	)
	try {
		uni.setStorageSync(STORAGE_KEY, cleaned)
	} catch (e) {
		/* ignore write errors */
	}
	return cleaned
}

export function addCustomCategory(name) {
	const text = normalizeCategory(name)
	if (!text || DEFAULT_INGREDIENT_CATEGORIES.includes(text) || text === '自定义' || text === '全部类别') {
		return getCustomCategories()
	}
	const next = [...getCustomCategories(), text]
	return setCustomCategories(next)
}

export function renameCustomCategory(oldName, newName) {
	const oldText = normalizeCategory(oldName)
	const newText = normalizeCategory(newName)
	if (!oldText || !newText) return getCustomCategories()
	const all = getCustomCategories()
	const idx = all.findIndex((x) => x === oldText)
	if (idx < 0) return all
	if (DEFAULT_INGREDIENT_CATEGORIES.includes(newText) || newText === '自定义' || newText === '全部类别') {
		return all
	}
	all[idx] = newText
	return setCustomCategories(all)
}

export function removeCustomCategory(name) {
	const text = normalizeCategory(name)
	if (!text) return getCustomCategories()
	return setCustomCategories(getCustomCategories().filter((x) => x !== text))
}

export function getFormCategoryOptions(currentCategory = '') {
	const current = normalizeCategory(currentCategory)
	const custom = getCustomCategories()
	const options = [...DEFAULT_INGREDIENT_CATEGORIES, ...custom]
	if (current && !options.includes(current) && current !== '自定义' && current !== '全部类别') {
		options.push(current)
	}
	return [...uniq(options), '自定义']
}
