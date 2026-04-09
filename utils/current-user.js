const USER_ID_STORAGE_KEY = 'currentUserId'

function normalizeUserId(value) {
	const n = Number(value)
	if (!Number.isFinite(n) || n <= 0) return 1
	return Math.floor(n)
}

export function getCurrentUserId() {
	try {
		const raw = uni.getStorageSync(USER_ID_STORAGE_KEY)
		return normalizeUserId(raw)
	} catch (_) {
		return 1
	}
}

export function setCurrentUserId(userId) {
	const normalized = normalizeUserId(userId)
	try {
		uni.setStorageSync(USER_ID_STORAGE_KEY, normalized)
	} catch (_) {}
	return normalized
}
