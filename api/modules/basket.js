import { request } from '../request'

export function getBasketItems(userId = 1) {
	return request({
		url: '/basket-items',
		method: 'GET',
		data: { userId }
	})
}

export function addBasketItem(payload = {}) {
	return request({
		url: '/basket-items',
		method: 'POST',
		data: payload
	})
}

export function upsertBasketItems(items = [], sourceRecipeName = '', userId = 1) {
	return request({
		url: '/basket-items/upsert',
		method: 'POST',
		data: {
			userId,
			items,
			sourceRecipeName
		}
	})
}

export function toggleBasketItemStatus(id, userId = 1) {
	return request({
		url: `/basket-items/${id}/toggle`,
		method: 'PATCH',
		data: { userId }
	})
}

export function removeBasketItem(id, userId = 1) {
	return request({
		url: `/basket-items/${id}?userId=${encodeURIComponent(userId)}`,
		method: 'DELETE',
		data: {}
	})
}

export function clearDoneBasketItems(userId = 1) {
	return request({
		url: `/basket-items/done/clear?userId=${encodeURIComponent(userId)}`,
		method: 'DELETE',
		data: {}
	})
}

export function restockDoneBasketItems(payload = {}) {
	return request({
		url: '/basket-items/done/restock',
		method: 'POST',
		data: payload
	})
}
