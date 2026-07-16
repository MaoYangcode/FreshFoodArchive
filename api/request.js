import {
	clearAuthToken,
	clearCurrentUserId,
	getAuthToken,
	getCurrentUserId,
	setAuthToken,
	setCurrentUserId
} from '../utils/current-user'

// NOTE: Real-device debug often changes LAN IP.
// Read storage-configured base URL first, then fall back to defaults.
const DEFAULT_BASE_URL_CANDIDATES = [
	'https://nnvicode.com'
]

const BASE_URL_STORAGE_KEY = 'FFA_API_BASE_URL'

function canUseUni() {
	return typeof uni !== 'undefined' && uni && typeof uni.request === 'function'
}

function normalizeBaseUrl(url) {
	const text = `${url || ''}`.trim()
	if (!text) return ''
	return text.replace(/\/+$/, '')
}

function readBaseUrlFromStorage() {
	if (!canUseUni() || typeof uni.getStorageSync !== 'function') return ''
	try {
		return normalizeBaseUrl(uni.getStorageSync(BASE_URL_STORAGE_KEY))
	} catch (e) {
		return ''
	}
}

function writeBaseUrlToStorage(value) {
	if (!canUseUni() || typeof uni.setStorageSync !== 'function' || value === undefined) return
	try {
		uni.setStorageSync(BASE_URL_STORAGE_KEY, value)
	} catch (e) {
		// Ignore storage write failures in restricted runtimes.
	}
}

function dedupe(list) {
	const result = []
	for (let i = 0; i < list.length; i += 1) {
		const item = list[i]
		if (!item) continue
		if (result.indexOf(item) !== -1) continue
		result.push(item)
	}
	return result
}

function getBaseCandidates() {
	const savedBase = readBaseUrlFromStorage()
	const list = savedBase ? [savedBase].concat(DEFAULT_BASE_URL_CANDIDATES) : DEFAULT_BASE_URL_CANDIDATES.slice()
	return dedupe(list)
}

let activeBaseUrl = getBaseCandidates()[0] || DEFAULT_BASE_URL_CANDIDATES[0]
let silentLoginPromise = null

export const BASE_URL = activeBaseUrl
export function getActiveBaseUrl() {
	return activeBaseUrl
}

export function setApiBaseUrl(baseUrl) {
	const normalized = normalizeBaseUrl(baseUrl)
	if (!normalized) return false
	activeBaseUrl = normalized
	writeBaseUrlToStorage(normalized)
	return true
}

function isUnauthorizedPayload(payload) {
	const statusCode = Number(payload?.statusCode || payload?.code || 0)
	return statusCode === 401 || `${payload?.error || ''}` === 'Unauthorized'
}

function toUserId(value) {
	const n = Number(value)
	if (!Number.isFinite(n) || n <= 0) return 0
	return Math.floor(n)
}

function requestWeChatCode() {
	return new Promise((resolve, reject) => {
		if (typeof uni === 'undefined' || typeof uni.login !== 'function') {
			reject(new Error('当前环境不支持微信登录'))
			return
		}
		uni.login({
			provider: 'weixin',
			success: ({ code }) => {
				const safeCode = `${code || ''}`.trim()
				if (!safeCode) {
					reject(new Error('未获取到微信登录凭证'))
					return
				}
				resolve(safeCode)
			},
			fail: (err) => reject(err || new Error('微信登录失败'))
		})
	})
}

function postWeChatLogin(baseUrl, code) {
	return new Promise((resolve, reject) => {
		uni.request({
			url: `${baseUrl}/auth/wechat-login`,
			method: 'POST',
			data: { code },
			header: { 'Content-Type': 'application/json' },
			timeout: 15000,
			success: (res) => {
				const payload = res.data || {}
				const statusCode = Number(res?.statusCode || 0)
				if (statusCode < 200 || statusCode >= 300) {
					console.error('静默登录失败', {
						statusCode,
						message: payload?.message || payload?.errmsg || payload?.errMsg || ''
					})
					reject(payload)
					return
				}
				const userId = toUserId(payload?.userId)
				const token = `${payload?.token || ''}`.trim()
				if (!userId || !token) {
					reject(new Error('invalid login payload'))
					return
				}
				setCurrentUserId(userId)
				setAuthToken(token)
				console.log('静默登录成功', { userId })
				resolve({ userId, token })
			},
			fail: (err) => {
				console.error('静默登录请求失败', err)
				reject(err)
			}
		})
	})
}

function silentLogin(baseUrl) {
	if (silentLoginPromise) return silentLoginPromise
	clearCurrentUserId()
	clearAuthToken()
	silentLoginPromise = requestWeChatCode()
		.then((code) => postWeChatLogin(baseUrl, code))
		.finally(() => {
			silentLoginPromise = null
		})
	return silentLoginPromise
}

function getRequestToken(baseUrl, isAuthLogin) {
	if (isAuthLogin) return Promise.resolve('')
	const token = `${getAuthToken() || ''}`.trim()
	if (token) return Promise.resolve(token)
	return silentLogin(baseUrl).then((res) => `${res?.token || getAuthToken() || ''}`.trim())
}

function requestOnce(baseUrl, { url, method = 'GET', data = {}, header = {}, timeout = 8000 }, retryAuth = true) {
	return new Promise((resolve, reject) => {
		const safeUrl = `${url || ''}`.trim()
		const isAuthLogin = safeUrl === '/auth/wechat-login' || safeUrl.includes('/auth/wechat-login?')
		const userId = getCurrentUserId()
		getRequestToken(baseUrl, isAuthLogin)
			.then((token) => {
				if (!isAuthLogin && !token) {
					reject({
						code: 401,
						message: '请先完成微信登录'
					})
					return
				}
				const headers = {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...(!isAuthLogin && userId > 0 ? { 'x-user-id': String(userId) } : {}),
					...header
				}
				uni.request({
					url: `${baseUrl}${url}`,
					method,
					data,
					header: headers,
					timeout,
					success: (res) => {
						const payload = res.data || {}
						const statusCode = Number(res?.statusCode || 0)
						if (statusCode < 200 || statusCode >= 300) {
							if (!isAuthLogin && retryAuth && isUnauthorizedPayload(payload)) {
								console.warn('登录已失效，正在重新静默登录')
								silentLogin(baseUrl)
									.then(() => requestOnce(baseUrl, { url, method, data, header, timeout }, false))
									.then(resolve)
									.catch(reject)
								return
							}
							reject(payload)
							return
						}
						if (payload.code === 0 || payload.code === undefined) {
							resolve(payload)
							return
						}
						reject(payload)
					},
					fail: (err) => {
						reject(err)
					}
				})
			})
			.catch((err) => reject(err))
	})
}

export function request({ url, method = 'GET', data = {}, header = {}, timeout = 8000 }) {
	const bases = getBaseCandidates()
	const orderedBases = dedupe([activeBaseUrl].concat(bases))
	const tryNext = (index, lastError) => {
		if (index >= orderedBases.length) {
			return Promise.reject(lastError || new Error('all base urls failed'))
		}
		const base = orderedBases[index]
		return requestOnce(base, { url, method, data, header, timeout })
			.then((payload) => {
				activeBaseUrl = base
				writeBaseUrlToStorage(base)
				return payload
			})
			.catch((err) => {
				// Business error from backend should not trigger base URL fallback.
				const hasBizCode = err && typeof err === 'object' && Object.prototype.hasOwnProperty.call(err, 'code')
				if (hasBizCode) return Promise.reject(err)
				return tryNext(index + 1, err)
			})
	}
	return tryNext(0, null)
}
