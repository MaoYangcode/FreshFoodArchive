const SMART_PURCHASE_RULES = [
	{ keywords: ['生抽', '老抽', '酱油', '蚝油', '料酒', '醋', '香油', '麻油', '芝麻油', '橄榄油', '菜籽油', '花生油', '食用油'], unit: '瓶', quantity: 1 },
	{ keywords: ['番茄酱', '沙拉酱', '芝麻酱', '豆瓣酱', '辣椒酱'], unit: '瓶', quantity: 1 },
	{ keywords: ['盐', '糖', '白糖', '红糖', '冰糖', '淀粉', '鸡精', '味精', '十三香', '孜然', '胡椒', '胡椒粉', '花椒粉', '辣椒面', '咖喱粉'], unit: '袋', quantity: 1 },
	{ keywords: ['蜂蜜'], unit: '瓶', quantity: 1 }
]

export function isTinyRecipeUnit(unitText) {
	const text = `${unitText || ''}`.trim()
	if (!text) return false
	return /(勺|匙|茶匙|汤匙|小勺|大勺|少许|适量|撮|滴)/.test(text)
}

export function isLikelyCondiment(item) {
	const category = `${item?.category || ''}`.trim()
	if (category === '调味品') return true
	const name = `${item?.name || ''}`.trim()
	if (!name) return false
	return /(盐|糖|酱油|生抽|老抽|蚝油|料酒|醋|胡椒|胡椒粉|花椒|辣椒|豆瓣酱|番茄酱|沙拉酱|芝麻酱|油|鸡精|味精|淀粉|蜂蜜|孜然|十三香|咖喱)/.test(name)
}

export function pickSmartPurchaseSpec(item) {
	const name = `${item?.name || ''}`.trim()
	for (const rule of SMART_PURCHASE_RULES) {
		if (rule.keywords.some((kw) => name.includes(kw))) {
			return { unit: rule.unit, quantity: Number(rule.quantity || 1) }
		}
	}
	const liquidLike = /(酱油|生抽|老抽|蚝油|料酒|醋|香油|麻油|芝麻油|橄榄油|菜籽油|花生油|食用油|蜂蜜)/.test(name)
	return { unit: liquidLike ? '瓶' : '袋', quantity: 1 }
}

export function toSmartBasketItem(rawItem) {
	const item = {
		name: `${rawItem?.name || ''}`.trim(),
		quantity: Number(rawItem?.quantity || 1),
		unit: `${rawItem?.unit || '份'}`.trim() || '份',
		category: `${rawItem?.category || ''}`.trim() || '其他'
	}
	if (!isLikelyCondiment(item) || !isTinyRecipeUnit(item.unit)) return item
	const smart = pickSmartPurchaseSpec(item)
	return {
		...item,
		quantity: Number(smart.quantity || 1),
		unit: smart.unit || '袋',
		category: '调味品'
	}
}
