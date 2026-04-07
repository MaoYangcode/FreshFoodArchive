import { request } from '../request'

export function getProfile(userId = 1) {
	return request({
		url: '/profile',
		method: 'GET',
		data: { userId }
	})
}

export function updateProfile(payload = {}) {
	return request({
		url: '/profile',
		method: 'PUT',
		data: payload
	})
}
