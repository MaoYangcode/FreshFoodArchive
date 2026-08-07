import { request } from '../request'

export function getFavoriteRecipesRemote() {
	return request({ url: '/favorite-recipes', method: 'GET' })
}

export function upsertFavoriteRecipeRemote(payload = {}) {
	return request({ url: '/favorite-recipes', method: 'POST', data: payload })
}

export function removeFavoriteRecipeRemote(name) {
	return request({
		url: `/favorite-recipes?name=${encodeURIComponent(`${name || ''}`)}`,
		method: 'DELETE'
	})
}

export function markFavoriteRecipeCompletedRemote(name) {
	return request({ url: '/favorite-recipes/completed', method: 'PATCH', data: { name } })
}
