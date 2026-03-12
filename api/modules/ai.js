import { request } from '../request'

export function recognizeIngredients(payload) {
	return request({
		url: '/api/ai/recognize-ingredients',
		method: 'POST',
		data: payload
	})
}
