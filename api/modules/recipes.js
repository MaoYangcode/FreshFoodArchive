import { request } from '../request'

export function recommendRecipes(payload) {
	return request({
		url: '/ai/generate-recipe',
		method: 'POST',
		data: payload,
		timeout: 90000
	})
}

export const generateRecipes = recommendRecipes

export function createRecipeTask(payload) {
	return request({
		url: '/ai/generate-recipe-task',
		method: 'POST',
		data: payload,
		timeout: 15000
	})
}

export function getRecipeTask(taskId) {
	return request({
		url: `/ai/generate-recipe-task/${encodeURIComponent(`${taskId || ''}`)}`,
		method: 'GET',
		timeout: 10000
	})
}

export function getRecipeDetail(payload) {
	return request({
		url: '/ai/generate-recipe-detail',
		method: 'POST',
		data: payload,
		timeout: 90000
	})
}

export function getRecipeSteps(payload) {
	return request({
		url: '/ai/generate-recipe-steps',
		method: 'POST',
		data: payload,
		timeout: 90000
	})
}

export function getRecipeNutrition(payload) {
	return request({
		url: '/ai/generate-recipe-nutrition',
		method: 'POST',
		data: payload,
		timeout: 90000
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
