import { request } from '../request'

export function getExpiryReminderSettings(userId = 1) {
	return request({
		url: '/expiry-reminder/settings',
		method: 'GET',
		data: { userId }
	})
}

export function updateExpiryReminderSettings(payload = {}) {
	return request({
		url: '/expiry-reminder/settings',
		method: 'PUT',
		data: payload
	})
}

export function scanExpiryReminderNow(userId = 1) {
	return request({
		url: '/expiry-reminder/scan-now',
		method: 'POST',
		data: { userId }
	})
}

export function getExpiryReminderLogs(userId = 1, limit = 20) {
	return request({
		url: '/expiry-reminder/logs',
		method: 'GET',
		data: { userId, limit }
	})
}
