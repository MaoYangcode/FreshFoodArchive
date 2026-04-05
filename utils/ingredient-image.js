const INGREDIENT_STATIC_VERSION = 3

function ingredientStaticUrl(filename) {
	return `/static/ingredients/${filename}?v=${INGREDIENT_STATIC_VERSION}`
}

const NAME_TO_FILE = {
	苹果: 'apple.png',
	香蕉: 'banana.png',
	牛肉: 'beef.png',
	西兰花: 'broccoli.png',
	花椰菜: 'broccoli.png',
	胡萝卜: 'carrot.png',
	鸡胸肉: 'chicken_breast.png',
	鸡肉: 'chicken_breast.png',
	黄瓜: 'cucumber.png',
	鸡蛋: 'egg.png',
	生菜: 'lettuce.png',
	牛奶: 'milk.png',
	蘑菇: 'mushroom.png',
	香菇: 'mushroom.png',
	面条: 'noodle..png',
	洋葱: 'onion.png',
	橙子: 'orange.png',
	猪肉: 'pork.png',
	土豆: 'potato.png',
	马铃薯: 'potato.png',
	大米: 'rice.png',
	米饭: 'rice.png',
	虾: 'shrimp.png',
	豆腐: 'tofu.png',
	番茄: 'tomato.png',
	西红柿: 'tomato.png'
}

const CATEGORY_TO_FILE = {
	水果: 'apple.png',
	蔬菜: 'broccoli.png',
	肉类: 'beef.png',
	蛋奶: 'egg.png',
	海鲜: 'shrimp.png',
	饮料: 'milk.png',
	调味品: 'onion.png',
	其他: 'tomato.png'
}

const CATEGORY_TO_EMOJI = {
	水果: '🍎',
	蔬菜: '🥬',
	肉类: '🥩',
	蛋奶: '🥚',
	海鲜: '🦐',
	饮料: '🥛',
	调味品: '🧂',
	其他: '🍽️'
}

const NAME_TO_ICONFONT = {
	苹果: 'icon-pingguo',
	香蕉: 'icon-xiangjiao',
	牛肉: 'icon-niurou',
	西兰花: 'icon-xilanhua',
	胡萝卜: 'icon-huluobu',
	红萝卜: 'icon-huluobu',
	萝卜: 'icon-luobu',
	鸡胸肉: 'icon-jixiongrou',
	鸡肉: 'icon-jirou',
	黄瓜: 'icon-huanggua',
	鸡蛋: 'icon-jidan',
	生菜: 'icon-shengcai',
	牛奶: 'icon-niunai',
	蘑菇: 'icon-mogu',
	香菇: 'icon-xianggu',
	面条: 'icon-miantiao',
	洋葱: 'icon-yangcong',
	橙子: 'icon-chengzi',
	猪肉: 'icon-zhurou',
	土豆: 'icon-tudou',
	马铃薯: 'icon-tudou',
	大米: 'icon-dami',
	米饭: 'icon-dami',
	虾: 'icon-xia',
	豆腐: 'icon-doufu',
	番茄: 'icon-fanqie',
	西红柿: 'icon-fanqie'
}

export function getIngredientImagePath(name, category = '') {
	const key = `${name || ''}`.trim()
	const file = NAME_TO_FILE[key] || CATEGORY_TO_FILE[`${category || ''}`.trim()]
	return file ? ingredientStaticUrl(file) : ''
}

export function getIngredientIconfontClass(name) {
	return NAME_TO_ICONFONT[`${name || ''}`.trim()] || ''
}

export function getIngredientSymbolId(name) {
	const cls = getIngredientIconfontClass(name)
	return cls ? `#${cls}` : ''
}

export function getCategoryEmoji(category) {
	return CATEGORY_TO_EMOJI[`${category || ''}`.trim()] || '🍽️'
}

