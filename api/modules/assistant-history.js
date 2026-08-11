import { request } from '../request'

export function getAssistantHistory(limit = 20) {
	const safeLimit = Math.min(30, Math.max(2, Number(limit) || 20))
	return request({ url: `/assistant-history?limit=${safeLimit}`, method: 'GET' })
}

export function saveAssistantTurn(payload = {}) {
	return request({ url: '/assistant-history/turn', method: 'POST', data: payload })
}

export function clearAssistantHistory() {
	return request({ url: '/assistant-history', method: 'DELETE' })
}
