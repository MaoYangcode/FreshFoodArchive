import { request } from '../request'

export function getIngredientList(params = {}) {
	return request({
		url: '/api/ingredients',
		method: 'GET',
		data: params
	})
}

export function createIngredient(payload) {
	return request({
		url: '/api/ingredients',
		method: 'POST',
		data: payload
	})
}

export function updateIngredient(id, payload) {
	return request({
		url: `/api/ingredients/${id}`,
		method: 'PUT',
		data: payload
	})
}

export function consumeIngredient(id, payload) {
	return request({
		url: `/api/ingredients/${id}/consume`,
		method: 'POST',
		data: payload
	})
}
