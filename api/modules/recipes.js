import { request } from '../request'

export function recommendRecipes(payload) {
	return request({
		url: '/api/ai/recommend-recipes',
		method: 'POST',
		data: payload
	})
}

export function getRecipeDetail(payload) {
	return request({
		url: '/api/ai/recipe-detail',
		method: 'POST',
		data: payload
	})
}

export function getFavoriteRecipes() {
	return request({
		url: '/api/favorites/recipes',
		method: 'GET'
	})
}

export function addFavoriteRecipe(payload) {
	return request({
		url: '/api/favorites/recipes',
		method: 'POST',
		data: payload
	})
}
