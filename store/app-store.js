const STORAGE_KEY = 'fresh-food-archive-state-v1'

const defaultState = {
	ingredients: [
		{
			id: 'ing-1',
			name: '西红柿',
			category: '蔬菜',
			quantity: 2,
			unit: '个',
			location: '冷藏',
			expireDate: '2026-03-12',
			createdAt: '2026-03-08 09:00:00'
		},
		{
			id: 'ing-2',
			name: '鸡蛋',
			category: '蛋奶',
			quantity: 10,
			unit: '个',
			location: '冷藏',
			expireDate: '2026-03-15',
			createdAt: '2026-03-08 09:05:00'
		},
		{
			id: 'ing-3',
			name: '牛肉',
			category: '肉类',
			quantity: 300,
			unit: 'g',
			location: '冷冻',
			expireDate: '2026-04-01',
			createdAt: '2026-03-08 09:08:00'
		}
	],
	takeoutRecords: [],
	favoriteRecipes: []
}

let state = JSON.parse(JSON.stringify(defaultState))
let initialized = false

function nowString() {
	const d = new Date()
	const pad = (n) => `${n}`.padStart(2, '0')
	const y = d.getFullYear()
	const m = pad(d.getMonth() + 1)
	const day = pad(d.getDate())
	const hh = pad(d.getHours())
	const mm = pad(d.getMinutes())
	const ss = pad(d.getSeconds())
	return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

function saveState() {
	uni.setStorageSync(STORAGE_KEY, state)
}

function loadState() {
	try {
		const cached = uni.getStorageSync(STORAGE_KEY)
		if (cached && typeof cached === 'object') {
			state = {
				ingredients: Array.isArray(cached.ingredients) ? cached.ingredients : [],
				takeoutRecords: Array.isArray(cached.takeoutRecords) ? cached.takeoutRecords : [],
				favoriteRecipes: Array.isArray(cached.favoriteRecipes) ? cached.favoriteRecipes : []
			}
			return
		}
	} catch (e) {
		console.warn('load storage failed', e)
	}
	state = JSON.parse(JSON.stringify(defaultState))
	saveState()
}

export function initStore() {
	if (initialized) return
	loadState()
	initialized = true
}

export function getIngredients() {
	initStore()
	return [...state.ingredients]
}

export function getIngredientById(id) {
	initStore()
	return state.ingredients.find((item) => item.id === id) || null
}

export function addIngredient(payload) {
	initStore()
	const item = {
		id: `ing-${Date.now()}`,
		name: payload.name,
		category: payload.category,
		quantity: Number(payload.quantity),
		unit: payload.unit,
		location: payload.location,
		expireDate: payload.expireDate,
		createdAt: nowString()
	}
	state.ingredients.unshift(item)
	saveState()
	return item
}

export function updateIngredient(id, payload) {
	initStore()
	const idx = state.ingredients.findIndex((item) => item.id === id)
	if (idx === -1) return false
	state.ingredients[idx] = {
		...state.ingredients[idx],
		...payload,
		quantity: Number(payload.quantity)
	}
	saveState()
	return true
}

export function consumeIngredient(id) {
	initStore()
	const idx = state.ingredients.findIndex((item) => item.id === id)
	if (idx === -1) return false
	const [removed] = state.ingredients.splice(idx, 1)
	state.takeoutRecords.unshift({
		id: `takeout-${Date.now()}`,
		name: removed.name,
		quantity: removed.quantity,
		unit: removed.unit,
		location: removed.location,
		time: nowString()
	})
	saveState()
	return true
}

export function deleteIngredient(id) {
	initStore()
	const idx = state.ingredients.findIndex((item) => item.id === id)
	if (idx === -1) return false
	state.ingredients.splice(idx, 1)
	saveState()
	return true
}

export function getTakeoutRecords() {
	initStore()
	return [...state.takeoutRecords]
}

export function addFavoriteRecipe(recipe) {
	initStore()
	const exists = state.favoriteRecipes.some((item) => item.name === recipe.name)
	if (exists) return false
	state.favoriteRecipes.unshift({
		id: `fav-${Date.now()}`,
		name: recipe.name,
		available: recipe.available || [],
		missing: recipe.missing || [],
		duration: recipe.duration || 20,
		difficulty: recipe.difficulty || '简单',
		createdAt: nowString()
	})
	saveState()
	return true
}

export function getFavoriteRecipes() {
	initStore()
	return [...state.favoriteRecipes]
}

export function getStats() {
	initStore()
	const total = state.ingredients.length
	const now = new Date()
	const threeDaysMs = 3 * 24 * 60 * 60 * 1000
	const expiring = state.ingredients.filter((item) => {
		const t = new Date(item.expireDate).getTime()
		return Number.isFinite(t) && t - now.getTime() <= threeDaysMs
	}).length
	const fresh = Math.max(total - expiring, 0)
	return { total, fresh, expiring }
}

export function getRecentIngredients(limit = 3) {
	initStore()
	return [...state.ingredients]
		.sort((a, b) => `${b.createdAt}`.localeCompare(`${a.createdAt}`))
		.slice(0, limit)
}
