import {
	getFavoriteRecipes,
	getMealPlans,
	replaceFavoriteRecipes,
	replaceMealPlans,
	upsertFavoriteRecipeLocal,
	upsertMealPlanLocal
} from '@/store/app-store'
import {
	getFavoriteRecipesRemote,
	markFavoriteRecipeCompletedRemote,
	removeFavoriteRecipeRemote,
	upsertFavoriteRecipeRemote
} from '@/api/modules/favorites'
import {
	getMealPlansRemote,
	markMealPlanCompletedRemote,
	removeMealPlanRemote,
	upsertMealPlanRemote
} from '@/api/modules/meal-plans'
let favoritesSyncPromise = null
let mealPlansSyncPromise = null

function unwrapList(source) {
	if (Array.isArray(source)) return source
	if (source && Array.isArray(source.data)) return source.data
	if (source && source.data && Array.isArray(source.data.data)) return source.data.data
	return []
}

async function uploadFavoriteMigration() {
	const localOnly = getFavoriteRecipes().filter((item) => !/^\d+$/.test(`${item?.id || ''}`))
	for (const item of localOnly) await upsertFavoriteRecipeRemote(item)
}

async function uploadMealPlanMigration() {
	const localOnly = getMealPlans().filter((item) => !/^\d+$/.test(`${item?.id || ''}`))
	for (const item of localOnly) {
		await upsertMealPlanRemote({ ...item, clientId: `${item?.clientId || item?.id || ''}` })
	}
}

export function syncFavoriteRecipes() {
	if (favoritesSyncPromise) return favoritesSyncPromise
	favoritesSyncPromise = (async () => {
		await uploadFavoriteMigration()
		const list = unwrapList(await getFavoriteRecipesRemote())
		return replaceFavoriteRecipes(list)
	})().finally(() => { favoritesSyncPromise = null })
	return favoritesSyncPromise
}

export function syncMealPlans() {
	if (mealPlansSyncPromise) return mealPlansSyncPromise
	mealPlansSyncPromise = (async () => {
		await uploadMealPlanMigration()
		const list = unwrapList(await getMealPlansRemote())
		return replaceMealPlans(list)
	})().finally(() => { mealPlansSyncPromise = null })
	return mealPlansSyncPromise
}

export async function saveFavoriteToServer(payload) {
	const row = await upsertFavoriteRecipeRemote(payload)
	return upsertFavoriteRecipeLocal(row)
}

export async function deleteFavoriteFromServer(name) {
	return removeFavoriteRecipeRemote(name)
}

export async function completeFavoriteOnServer(name) {
	const row = await markFavoriteRecipeCompletedRemote(name)
	return upsertFavoriteRecipeLocal(row)
}

export async function saveMealPlanToServer(payload) {
	const row = await upsertMealPlanRemote({ ...payload, clientId: `${payload?.clientId || payload?.id || ''}` })
	return upsertMealPlanLocal(row)
}

export async function deleteMealPlanFromServer(id) {
	return removeMealPlanRemote(id)
}

export async function completeMealPlanOnServer(id) {
	const row = await markMealPlanCompletedRemote(id)
	return upsertMealPlanLocal(row)
}
