import { request } from '../request'

export function recommendRecipes(payload) {
	return request({
		url: '/ai/generate-recipe',
		method: 'POST',
		data: payload,
		timeout: 60000
	})
}

export const generateRecipes = recommendRecipes

export function getRecipeDetail(payload) {
	return request({
		url: '/ai/generate-recipe',
		method: 'POST',
		data: payload,
		timeout: 60000
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
