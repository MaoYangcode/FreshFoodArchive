import { getCurrentUserId } from '../utils/current-user'

// NOTE: Real-device debug often changes LAN IP.
// Read storage-configured base URL first, then fall back to defaults.
const DEFAULT_BASE_URL_CANDIDATES = [
	'http://192.168.10.215:3000',
	'http://172.20.10.10:3000'
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

function requestOnce(baseUrl, { url, method = 'GET', data = {}, header = {}, timeout = 8000 }) {
	return new Promise((resolve, reject) => {
		const userId = getCurrentUserId()
		const headers = {
			'x-user-id': String(userId),
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
