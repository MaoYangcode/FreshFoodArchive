const USER_ID_STORAGE_KEY = 'currentUserId'
const AUTH_TOKEN_STORAGE_KEY = 'ffaAuthToken'

function normalizeUserId(value) {
	const n = Number(value)
	if (!Number.isFinite(n) || n <= 0) return 0
	return Math.floor(n)
}

export function getCurrentUserId() {
	try {
		const raw = uni.getStorageSync(USER_ID_STORAGE_KEY)
		return normalizeUserId(raw)
	} catch (_) {
		return 0
	}
}

export function setCurrentUserId(userId) {
	const normalized = normalizeUserId(userId)
	try {
		uni.setStorageSync(USER_ID_STORAGE_KEY, normalized)
	} catch (_) {}
	return normalized
}

export function clearCurrentUserId() {
	try {
		uni.removeStorageSync(USER_ID_STORAGE_KEY)
	} catch (_) {}
}

function normalizeToken(value) {
	return `${value || ''}`.trim()
}

export function getAuthToken() {
	try {
		return normalizeToken(uni.getStorageSync(AUTH_TOKEN_STORAGE_KEY))
	} catch (_) {
		return ''
	}
}

export function setAuthToken(token) {
	const normalized = normalizeToken(token)
	try {
		uni.setStorageSync(AUTH_TOKEN_STORAGE_KEY, normalized)
	} catch (_) {}
	return normalized
}

export function clearAuthToken() {
	try {
		uni.removeStorageSync(AUTH_TOKEN_STORAGE_KEY)
	} catch (_) {}
}
