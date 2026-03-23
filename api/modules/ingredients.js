import { request } from '../request'

function unwrapListPayload(source) {
	if (Array.isArray(source)) return source
	if (source && Array.isArray(source.data)) return source.data
	if (source && source.data && Array.isArray(source.data.data)) return source.data.data
	return []
}

export function getIngredientList(params = {}) {
	return request({
		url: '/ingredients',
		method: 'GET',
		data: params
	})
}

export function createIngredient(payload) {
	return request({
		url: '/ingredients',
		method: 'POST',
		data: payload
	})
}

export function updateIngredient(id, payload) {
	return request({
		url: `/ingredients/${id}`,
		method: 'PATCH',
		data: payload
	})
}

export function consumeIngredient(id, payload) {
	return request({
		url: `/ingredients/${id}/consume`,
		method: 'POST',
		data: payload
	})
}

export async function getIngredientDetail(id) {
	try {
		return await request({
			url: `/ingredients/${id}`,
			method: 'GET'
		})
	} catch (e) {
		const isNotFound = e && (e.statusCode === 404 || `${e.message || ''}`.includes('Cannot GET'))
		if (!isNotFound) throw e
		const listRes = await getIngredientList()
		const list = unwrapListPayload(listRes)
		const current = list.find((item) => `${item.id}` === `${id}`)
		if (current) return current
		throw e
	}
}

export function deleteIngredient(id) {
	return request({
		url: `/ingredients/${id}`,
		method: 'DELETE'
	})
}