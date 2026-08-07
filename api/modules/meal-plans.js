import { request } from '../request'

export function getMealPlansRemote(date = '') {
	const query = date ? `?date=${encodeURIComponent(`${date}`.slice(0, 10))}` : ''
	return request({ url: `/meal-plans${query}`, method: 'GET' })
}

export function upsertMealPlanRemote(payload = {}) {
	return request({ url: '/meal-plans', method: 'POST', data: payload })
}

export function removeMealPlanRemote(id) {
	return request({ url: `/meal-plans/${encodeURIComponent(`${id}`)}`, method: 'DELETE' })
}

export function markMealPlanCompletedRemote(id) {
	return request({ url: `/meal-plans/${encodeURIComponent(`${id}`)}/completed`, method: 'PATCH' })
}
