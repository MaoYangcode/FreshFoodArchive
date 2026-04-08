import { request } from '../request'

export function getShelfLifeSettings(userId = 1) {
	return request({
		url: '/shelf-life-settings',
		method: 'GET',
		data: { userId }
	})
}

export function updateShelfLifeSettings(payload = {}) {
	return request({
		url: '/shelf-life-settings',
		method: 'PUT',
		data: payload
	})
}
